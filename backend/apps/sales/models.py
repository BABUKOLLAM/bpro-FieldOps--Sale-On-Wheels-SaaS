from django.db import models

from apps.company.constants import INDIAN_STATES
from apps.core.models import BaseModel


class DocumentSequence(BaseModel):
    """Atomic per-financial-year document numbering (invoice/order/receipt/
    credit-note), scoped per GST registration since each GSTIN's invoice
    series must be independently sequential for GST compliance."""

    doc_type = models.CharField(max_length=20)
    gst_registration = models.ForeignKey("company.GSTRegistration", on_delete=models.CASCADE, related_name="+")
    financial_year = models.CharField(max_length=9, help_text="e.g. 2026-27")
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("doc_type", "gst_registration", "financial_year")


class SalesOrder(BaseModel):
    STATUS_OPEN = "open"
    STATUS_FULFILLED = "fulfilled"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [(STATUS_OPEN, "Open"), (STATUS_FULFILLED, "Fulfilled"), (STATUS_CANCELLED, "Cancelled")]

    order_no = models.CharField(max_length=30, blank=True, db_index=True)
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="sales_orders")
    agent = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="sales_orders")
    trip = models.ForeignKey("fleet.Trip", null=True, blank=True, on_delete=models.SET_NULL, related_name="sales_orders")
    order_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)
    notes = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.order_no or str(self.id)


class SalesOrderLine(BaseModel):
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey("catalog.Item", on_delete=models.PROTECT, related_name="+")
    qty = models.DecimalField(max_digits=12, decimal_places=3)
    rate = models.DecimalField(max_digits=12, decimal_places=2)


class Invoice(BaseModel):
    """Spot-billing / delivery invoice (FR-01). The primary key is
    client-generated on the mobile app at creation time, offline — it is
    the idempotency key used end-to-end: by apps.mobile_sync to dedupe a
    retried push, and by apps.integrations.SyncLogEntry to guarantee this
    invoice is never posted to Tally twice."""

    SOURCE_SPOT = "spot"
    SOURCE_ORDER_FULFILLMENT = "order_fulfillment"
    SOURCE_CHOICES = [(SOURCE_SPOT, "Spot billing"), (SOURCE_ORDER_FULFILLMENT, "Order fulfillment")]

    PAYMENT_UNPAID = "unpaid"
    PAYMENT_PARTIAL = "partial"
    PAYMENT_PAID = "paid"
    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_UNPAID, "Unpaid"), (PAYMENT_PARTIAL, "Partially paid"), (PAYMENT_PAID, "Paid"),
    ]

    CREDIT_OK = "ok"
    CREDIT_PENDING_REVIEW = "pending_review"
    CREDIT_OVERRIDDEN = "overridden"
    CREDIT_STATUS_CHOICES = [
        (CREDIT_OK, "OK"), (CREDIT_PENDING_REVIEW, "Pending review"), (CREDIT_OVERRIDDEN, "Overridden"),
    ]

    SYNC_PENDING = "pending"
    SYNC_SYNCED = "synced"
    SYNC_FAILED = "failed"
    SYNC_STATUS_CHOICES = [(SYNC_PENDING, "Pending"), (SYNC_SYNCED, "Synced"), (SYNC_FAILED, "Failed")]

    invoice_no = models.CharField(max_length=30, blank=True, db_index=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_SPOT)
    sales_order = models.ForeignKey(SalesOrder, null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices")
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="invoices")
    agent = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="invoices")
    trip = models.ForeignKey("fleet.Trip", null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices")
    godown = models.ForeignKey("inventory.Godown", on_delete=models.PROTECT, related_name="invoices")
    gst_registration = models.ForeignKey("company.GSTRegistration", on_delete=models.PROTECT, related_name="invoices")
    place_of_supply_state = models.CharField(max_length=2, choices=INDIAN_STATES)

    invoice_date = models.DateField()
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_UNPAID)
    credit_check_status = models.CharField(max_length=20, choices=CREDIT_STATUS_CHOICES, default=CREDIT_OK)
    credit_override_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    credit_override_reason = models.CharField(max_length=255, blank=True)

    sync_status = models.CharField(max_length=20, choices=SYNC_STATUS_CHOICES, default=SYNC_PENDING)
    signature_image = models.ImageField(upload_to="signatures/", null=True, blank=True)
    device_created_at = models.DateTimeField(
        null=True, blank=True, help_text="When the invoice was actually created on-device, for offline records."
    )

    DELIVERY_VIA_NONE = ""
    DELIVERY_VIA_SIGNATURE = "signature"
    DELIVERY_VIA_OTP = "otp"
    DELIVERY_VIA_CHOICES = [
        (DELIVERY_VIA_NONE, "Not confirmed"), (DELIVERY_VIA_SIGNATURE, "Signature"), (DELIVERY_VIA_OTP, "OTP"),
    ]
    delivery_confirmed_via = models.CharField(max_length=10, choices=DELIVERY_VIA_CHOICES, blank=True, default="")
    delivery_confirmed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.invoice_no or str(self.id)


class InvoiceDeliveryOTP(BaseModel):
    """FR-12 proof-of-delivery: the alternative to a signature. One row
    per invoice — a re-sent OTP replaces the previous code rather than
    accumulating a history, since only the latest one is ever valid.
    The code itself is hashed (django.contrib.auth.hashers), never
    stored or returned in plaintext once generated."""

    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name="delivery_otp")
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveIntegerField(default=0)
    verified_at = models.DateTimeField(null=True, blank=True)

    MAX_ATTEMPTS = 5


class InvoiceLine(BaseModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey("catalog.Item", on_delete=models.PROTECT, related_name="+")
    qty = models.DecimalField(max_digits=12, decimal_places=3)
    rate = models.DecimalField(max_digits=12, decimal_places=2, help_text="Unit rate before tax/discount.")
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_bonus = models.BooleanField(
        default=False, help_text="System-generated free line from a BXGY scheme, not entered by the agent.",
    )
    bxgy_scheme = models.ForeignKey(
        "catalog.SchemeBXGY", null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )

    def __str__(self):
        return f"{self.item.sku} x{self.qty}"


class Receipt(BaseModel):
    """Collection against one or more outstanding invoices (FR-03).
    Client-generated PK — same idempotency rationale as Invoice."""

    MODE_CASH = "cash"
    MODE_CHEQUE = "cheque"
    MODE_UPI = "upi"
    MODE_CARD = "card"
    MODE_CHOICES = [(MODE_CASH, "Cash"), (MODE_CHEQUE, "Cheque"), (MODE_UPI, "UPI"), (MODE_CARD, "Card")]

    receipt_no = models.CharField(max_length=30, blank=True, db_index=True)
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="receipts")
    agent = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="receipts")
    trip = models.ForeignKey("fleet.Trip", null=True, blank=True, on_delete=models.SET_NULL, related_name="receipts")
    mode = models.CharField(max_length=20, choices=MODE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference_no = models.CharField(max_length=100, blank=True, help_text="Cheque no / UPI txn id / card ref.")
    received_at = models.DateTimeField()
    sync_status = models.CharField(max_length=20, choices=Invoice.SYNC_STATUS_CHOICES, default=Invoice.SYNC_PENDING)

    def __str__(self):
        return self.receipt_no or str(self.id)


class PaymentAllocation(BaseModel):
    """How a Receipt's amount is allocated across one or more invoices."""

    receipt = models.ForeignKey(Receipt, on_delete=models.CASCADE, related_name="allocations")
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payment_allocations")
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("receipt", "invoice")


class CreditNote(BaseModel):
    """Returns & replacements (FR-04). Client-generated PK — same
    idempotency rationale as Invoice."""

    CONDITION_SELLABLE = "sellable"
    CONDITION_DAMAGED = "damaged"
    CONDITION_EXPIRED = "expired"
    CONDITION_CHOICES = [
        (CONDITION_SELLABLE, "Sellable"), (CONDITION_DAMAGED, "Damaged"), (CONDITION_EXPIRED, "Expired"),
    ]

    credit_note_no = models.CharField(max_length=30, blank=True, db_index=True)
    original_invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="credit_notes")
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="credit_notes")
    agent = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="credit_notes")
    trip = models.ForeignKey("fleet.Trip", null=True, blank=True, on_delete=models.SET_NULL, related_name="credit_notes")
    reason_code = models.CharField(max_length=50)
    note_date = models.DateField()
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sync_status = models.CharField(max_length=20, choices=Invoice.SYNC_STATUS_CHOICES, default=Invoice.SYNC_PENDING)

    def __str__(self):
        return self.credit_note_no or str(self.id)


class CreditNoteLine(BaseModel):
    credit_note = models.ForeignKey(CreditNote, on_delete=models.CASCADE, related_name="lines")
    original_invoice_line = models.ForeignKey(InvoiceLine, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    item = models.ForeignKey("catalog.Item", on_delete=models.PROTECT, related_name="+")
    qty = models.DecimalField(max_digits=12, decimal_places=3)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    condition = models.CharField(max_length=20, choices=CreditNote.CONDITION_CHOICES)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
