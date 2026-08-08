import secrets
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.catalog.models import PriceList, PriceListItem, Scheme, SchemeBXGY
from apps.company.models import Company
from apps.core.exceptions import DomainError
from apps.inventory.models import StockLedgerEntry
from apps.inventory.services import post_stock_movement
from apps.notifications.models import MessageTemplate
from apps.notifications.services import render_template, send_sms

from .models import CreditNote, DocumentSequence, Invoice, InvoiceDeliveryOTP, InvoiceLine, Receipt

OTP_VALIDITY_MINUTES = 10


def financial_year_for(d: date) -> str:
    company = Company.objects.first()
    fy_start_month = company.fy_start_month if company else 4
    start_year = d.year if d.month >= fy_start_month else d.year - 1
    return f"{start_year}-{str(start_year + 1)[-2:]}"


@transaction.atomic
def next_document_number(doc_type: str, gst_registration, on_date: date, prefix: str) -> str:
    fy = financial_year_for(on_date)
    seq, _ = DocumentSequence.objects.select_for_update().get_or_create(
        doc_type=doc_type, gst_registration=gst_registration, financial_year=fy,
    )
    seq.last_number += 1
    seq.save(update_fields=["last_number"])
    return f"{prefix}/{fy}/{seq.last_number:05d}"


def best_scheme_discount(item, qty: Decimal, rate: Decimal, on_date: date) -> Decimal:
    """Scheme engine (FR-14): finds the best applicable scheme for this
    item on this date — flat, percent, or quantity-tiered slab — and
    returns the discount amount for the full line. Returns 0 if none
    applies. (BXGY is not a discount-on-a-line at all — see the note on
    apps.catalog.models.Scheme — so it's out of scope here.)"""
    candidates = Scheme.objects.filter(
        is_active=True, valid_from__lte=on_date, valid_to__gte=on_date,
    ).filter(models_q_for_item(item)).prefetch_related("slabs")

    gross = qty * rate
    best = Decimal("0")
    for scheme in candidates:
        if not scheme.applies_to(item):
            continue
        if scheme.discount_type == Scheme.DISCOUNT_SLAB:
            slab = next((s for s in scheme.slabs.all() if s.matches(qty)), None)
            if slab is None:
                continue
            if slab.discount_type == Scheme.DISCOUNT_PERCENT:
                discount = (gross * slab.value / Decimal("100")).quantize(Decimal("0.01"))
            else:
                discount = min(slab.value, gross)
        elif scheme.discount_type == Scheme.DISCOUNT_PERCENT:
            discount = (gross * scheme.value / Decimal("100")).quantize(Decimal("0.01"))
        else:
            discount = min(scheme.value, gross)
        best = max(best, discount)
    return best


def models_q_for_item(item):
    from django.db.models import Q

    return Q(item=item) | Q(category=item.category)


def apply_bxgy_bonus_lines(invoice: Invoice, on_date: date):
    """BXGY (FR-14 remainder): derives free bonus lines from the
    invoice's real (non-bonus) line quantities and a full replace —
    delete every previously-generated bonus line, then re-derive from
    scratch — so this is safe to call on every recompute, including
    edits that change a trigger item's quantity after the fact."""
    invoice.lines.filter(is_bonus=True).delete()

    trigger_qty_by_item = {
        row["item_id"]: row["total_qty"]
        for row in invoice.lines.filter(is_bonus=False).values("item_id").annotate(total_qty=Sum("qty"))
    }
    if not trigger_qty_by_item:
        return

    schemes = SchemeBXGY.objects.filter(
        is_active=True, valid_from__lte=on_date, valid_to__gte=on_date,
        trigger_item_id__in=trigger_qty_by_item.keys(),
    ).select_related("bonus_item")
    if not schemes:
        return

    default_price_list = PriceList.objects.filter(is_default=True, is_active=True).first()

    for scheme in schemes:
        multiples = scheme.multiples_for(trigger_qty_by_item[scheme.trigger_item_id])
        if multiples <= 0:
            continue
        rate = Decimal("0")
        if default_price_list:
            entry = PriceListItem.objects.filter(price_list=default_price_list, item=scheme.bonus_item).first()
            if entry:
                rate = entry.rate
        InvoiceLine.objects.create(
            invoice=invoice, item=scheme.bonus_item, qty=scheme.bonus_qty * multiples, rate=rate,
            is_bonus=True, bxgy_scheme=scheme,
        )


def compute_line(line: InvoiceLine, gst_rate_source_state: str, place_of_supply_state: str, on_date: date):
    gross = line.qty * line.rate
    if line.is_bonus:
        # Always fully waived, regardless of any Scheme that might also
        # match this item — it's a freebie, not a discounted sale.
        line.discount_amount = gross
    elif not line.discount_amount:
        line.discount_amount = best_scheme_discount(line.item, line.qty, line.rate, on_date)
    line.taxable_amount = (gross - line.discount_amount).quantize(Decimal("0.01"))

    gst_rate = line.item.gst_rate
    tax_amount = (line.taxable_amount * gst_rate / Decimal("100")).quantize(Decimal("0.01"))

    if gst_rate_source_state == place_of_supply_state:
        line.cgst_amount = (tax_amount / 2).quantize(Decimal("0.01"))
        line.sgst_amount = tax_amount - line.cgst_amount
        line.igst_amount = Decimal("0")
    else:
        line.cgst_amount = Decimal("0")
        line.sgst_amount = Decimal("0")
        line.igst_amount = tax_amount

    line.line_total = line.taxable_amount + line.cgst_amount + line.sgst_amount + line.igst_amount
    return line


@transaction.atomic
def recompute_invoice(invoice: Invoice):
    """Server is the source of truth for money: totals are always
    recomputed from the item master + scheme rules here, never trusted
    from the client — this is what lets an offline-created invoice be
    safely re-validated at sync time."""
    apply_bxgy_bonus_lines(invoice, invoice.invoice_date)
    lines = list(invoice.lines.select_related("item").all())
    subtotal = discount_total = tax_total = Decimal("0")
    for line in lines:
        compute_line(line, invoice.gst_registration.state, invoice.place_of_supply_state, invoice.invoice_date)
        line.save()
        subtotal += line.taxable_amount + line.discount_amount
        discount_total += line.discount_amount
        tax_total += line.cgst_amount + line.sgst_amount + line.igst_amount

    invoice.subtotal = subtotal
    invoice.discount_total = discount_total
    invoice.tax_total = tax_total
    invoice.grand_total = subtotal - discount_total + tax_total
    invoice.save(update_fields=["subtotal", "discount_total", "tax_total", "grand_total"])
    return invoice


@transaction.atomic
def finalize_invoice(invoice: Invoice, *, override_by=None, override_reason: str = ""):
    """Runs credit-limit enforcement (FR-10), recomputes totals, deducts
    van stock, and assigns the invoice number — the single place an
    invoice becomes "real". Called both for online creation and when a
    previously-offline invoice is first processed at sync time."""
    recompute_invoice(invoice)

    customer = invoice.customer
    status = customer.credit_status(additional_amount=invoice.grand_total)
    if status != "ok":
        if override_by is not None:
            invoice.credit_check_status = Invoice.CREDIT_OVERRIDDEN
            invoice.credit_override_by = override_by
            invoice.credit_override_reason = override_reason
        else:
            # BRD FR-11: offline/online billing must never be blocked outright —
            # it is flagged for supervisor review instead (AR-04).
            invoice.credit_check_status = Invoice.CREDIT_PENDING_REVIEW
    else:
        invoice.credit_check_status = Invoice.CREDIT_OK

    if not invoice.invoice_no:
        invoice.invoice_no = next_document_number(
            "invoice", invoice.gst_registration, invoice.invoice_date, "INV"
        )

    invoice.save(update_fields=["invoice_no", "credit_check_status", "credit_override_by", "credit_override_reason"])

    for line in invoice.lines.all():
        post_stock_movement(
            godown=invoice.godown, item=line.item, qty=-line.qty, txn_type=StockLedgerEntry.TXN_SALE,
            reference_type="invoice", reference_id=invoice.id,
        )

    customer.outstanding_balance += invoice.grand_total
    customer.save(update_fields=["outstanding_balance"])

    from apps.integrations.models import Webhook
    from apps.integrations.tasks import enqueue_tally_job
    from apps.integrations.webhooks import dispatch_event

    transaction.on_commit(lambda: enqueue_tally_job("invoice", invoice.id))
    transaction.on_commit(lambda: dispatch_event(Webhook.EVENT_INVOICE_FINALIZED, invoice))
    return invoice


@transaction.atomic
def finalize_receipt(receipt: Receipt):
    if not receipt.receipt_no:
        # Receipts aren't tied to a single GST registration the way invoices
        # are; use the customer's invoices' registration, falling back to
        # the company's default.
        gst_registration = (
            receipt.customer.invoices.order_by("-invoice_date").values_list("gst_registration", flat=True).first()
        )
        from apps.company.models import GSTRegistration

        gst_registration = (
            GSTRegistration.objects.get(pk=gst_registration)
            if gst_registration
            else GSTRegistration.objects.filter(is_default=True).first()
        )
        receipt.receipt_no = next_document_number("receipt", gst_registration, receipt.received_at.date(), "RCPT")
        receipt.save(update_fields=["receipt_no"])

    allocated = sum((a.amount for a in receipt.allocations.all()), Decimal("0"))
    if allocated > receipt.amount:
        raise DomainError("Receipt allocations exceed the receipt amount.", code="allocation_exceeds_amount")

    for allocation in receipt.allocations.select_related("invoice").all():
        invoice = allocation.invoice
        paid_so_far = sum(
            (a.amount for a in invoice.payment_allocations.all()), Decimal("0")
        )
        invoice.payment_status = (
            Invoice.PAYMENT_PAID if paid_so_far >= invoice.grand_total else Invoice.PAYMENT_PARTIAL
        )
        invoice.save(update_fields=["payment_status"])

    receipt.customer.outstanding_balance -= receipt.amount
    receipt.customer.save(update_fields=["outstanding_balance"])

    from apps.integrations.models import Webhook
    from apps.integrations.tasks import enqueue_tally_job
    from apps.integrations.webhooks import dispatch_event

    transaction.on_commit(lambda: enqueue_tally_job("receipt", receipt.id))
    transaction.on_commit(lambda: dispatch_event(Webhook.EVENT_RECEIPT_FINALIZED, receipt))
    return receipt


@transaction.atomic
def finalize_credit_note(credit_note: CreditNote):
    """Every returned unit — sellable, damaged, or expired — physically
    lands back in the van, so every condition posts a stock movement
    (reverse logistics — FM-11): without this, damaged/expired returns
    had zero audit trail, silently vanishing from the ledger the moment
    they were collected. `CreditNoteLine.condition` remains the field
    downstream reporting (see apps.fleet.views.FleetDashboardView's
    reverse-logistics reconciliation) reads to tell sellable stock apart
    from stock still awaiting return to the warehouse."""
    if not credit_note.credit_note_no:
        credit_note.credit_note_no = next_document_number(
            "credit_note", credit_note.original_invoice.gst_registration, credit_note.note_date, "CN"
        )

    total = Decimal("0")
    for line in credit_note.lines.select_related("item").all():
        line.line_total = (line.qty * line.rate).quantize(Decimal("0.01"))
        line.save(update_fields=["line_total"])
        total += line.line_total

        godown = credit_note.original_invoice.godown
        post_stock_movement(
            godown=godown, item=line.item, qty=line.qty, txn_type=StockLedgerEntry.TXN_SALE_RETURN,
            reference_type="credit_note", reference_id=credit_note.id,
        )

    credit_note.grand_total = total
    credit_note.save(update_fields=["credit_note_no", "grand_total"])

    credit_note.customer.outstanding_balance -= total
    credit_note.customer.save(update_fields=["outstanding_balance"])

    from apps.integrations.models import Webhook
    from apps.integrations.tasks import enqueue_tally_job
    from apps.integrations.webhooks import dispatch_event

    transaction.on_commit(lambda: enqueue_tally_job("credit_note", credit_note.id))
    transaction.on_commit(lambda: dispatch_event(Webhook.EVENT_CREDIT_NOTE_FINALIZED, credit_note))
    return credit_note


def send_delivery_otp(invoice: Invoice) -> InvoiceDeliveryOTP:
    """FR-12 proof-of-delivery, alternative to a signature. A re-send
    replaces any previous unverified OTP for this invoice rather than
    stacking — only the latest code is ever valid."""
    if not invoice.customer.phone:
        raise DomainError("Customer has no phone number on file.", code="no_phone")

    code = f"{secrets.randbelow(1_000_000):06d}"
    otp, _ = InvoiceDeliveryOTP.objects.update_or_create(
        invoice=invoice,
        defaults={
            "code_hash": make_password(code),
            "expires_at": timezone.now() + timedelta(minutes=OTP_VALIDITY_MINUTES),
            "attempts": 0,
            "verified_at": None,
        },
    )
    _, body = render_template(
        MessageTemplate.KEY_DELIVERY_OTP,
        invoice_no=invoice.invoice_no or invoice.id, code=code, validity_minutes=OTP_VALIDITY_MINUTES,
    )
    send_sms(invoice.customer.phone, body)
    return otp


@transaction.atomic
def verify_delivery_otp(invoice: Invoice, code: str) -> Invoice:
    try:
        otp = invoice.delivery_otp
    except InvoiceDeliveryOTP.DoesNotExist:
        raise DomainError("No OTP has been sent for this invoice.", code="otp_not_sent")

    if otp.verified_at:
        raise DomainError("This invoice's delivery is already confirmed.", code="already_verified")
    if otp.attempts >= InvoiceDeliveryOTP.MAX_ATTEMPTS:
        raise DomainError("Too many incorrect attempts — request a new OTP.", code="otp_locked")
    if timezone.now() > otp.expires_at:
        raise DomainError("This OTP has expired — request a new one.", code="otp_expired")

    if not check_password(code, otp.code_hash):
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        raise DomainError("Incorrect OTP.", code="otp_incorrect")

    otp.verified_at = timezone.now()
    otp.save(update_fields=["verified_at"])

    invoice.delivery_confirmed_via = Invoice.DELIVERY_VIA_OTP
    invoice.delivery_confirmed_at = otp.verified_at
    invoice.save(update_fields=["delivery_confirmed_via", "delivery_confirmed_at"])
    return invoice
