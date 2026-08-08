"""
UPI/card payment collection (BRD Section 18) — gateway-ready scaffolding.

Absolute constraint: this module must never itself move money. Creating
a PaymentOrder only ever creates a record of *intent* — on a real
gateway, the actual transfer happens entirely on the gateway's own
hosted checkout page, between the customer and their bank/UPI app, and
is only ever *reported back* to this codebase via a signature-verified
webhook (verify_and_record_payment). Without a real gateway configured
(the default — see PaymentGatewayConnection), every function here is
inert: no network call, no state change beyond a locally-tagged "mock"
order that can never be marked paid by anything but that same explicit
mock-confirm path (used for demo/dev only, never wired to a real
customer-facing action).

Razorpay's Orders/webhook API shape below is illustrative, not verified
against their live API in this session — same caveat as the Busy/Marg
connectors' docstrings. A deployment operator must confirm this against
Razorpay's actual current docs before relying on it in production.
"""
import hashlib
import hmac
import json
import urllib.error
import urllib.request
import uuid
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import DomainError
from apps.sales.models import Invoice, Receipt

from .models import PaymentGatewayConnection, PaymentOrder

RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"


def _active_connection() -> PaymentGatewayConnection:
    connection = PaymentGatewayConnection.objects.filter(is_active=True).first()
    if connection is None:
        connection = PaymentGatewayConnection.objects.create(gateway_type=PaymentGatewayConnection.GATEWAY_MOCK)
    return connection


def create_payment_order(invoice: Invoice, amount: Decimal) -> PaymentOrder:
    """Creates a PaymentOrder for `amount` against `invoice`. Mock mode
    (no real gateway configured — the default) fabricates an order id
    and makes no network call, mirroring the console-fallback pattern
    used for email/push/SMS elsewhere in this codebase."""
    if amount <= 0:
        raise DomainError("Payment amount must be positive.", code="invalid_amount")

    connection = _active_connection()

    if connection.gateway_type == PaymentGatewayConnection.GATEWAY_MOCK:
        order = PaymentOrder.objects.create(
            invoice=invoice, gateway_type=PaymentGatewayConnection.GATEWAY_MOCK,
            gateway_order_id=f"MOCK-ORDER-{uuid.uuid4().hex[:12]}", amount=amount,
        )
        print(f"[payments:mock] order={order.gateway_order_id} invoice={invoice.id} amount={amount}")
        return order

    if connection.gateway_type == PaymentGatewayConnection.GATEWAY_RAZORPAY:
        creds = connection.credentials
        key_id, key_secret = creds.get("key_id", ""), creds.get("key_secret", "")
        if not key_id or not key_secret:
            raise DomainError("Razorpay is selected but not configured (missing key_id/key_secret).", code="gateway_not_configured")

        import base64

        body = json.dumps({
            "amount": int(amount * 100),  # paise
            "currency": "INR",
            "receipt": str(invoice.id),
        }).encode("utf-8")
        auth = base64.b64encode(f"{key_id}:{key_secret}".encode()).decode()
        request = urllib.request.Request(
            RAZORPAY_ORDERS_URL, data=body, method="POST",
            headers={"Content-Type": "application/json", "Authorization": f"Basic {auth}"},
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError) as exc:
            raise DomainError(f"Could not reach Razorpay: {exc}", code="gateway_unreachable") from exc

        return PaymentOrder.objects.create(
            invoice=invoice, gateway_type=PaymentGatewayConnection.GATEWAY_RAZORPAY,
            gateway_order_id=data.get("id", ""), amount=amount,
        )

    raise DomainError(f"Unsupported gateway_type={connection.gateway_type!r}.", code="unsupported_gateway")


class PaymentVerificationError(Exception):
    """Raised when a webhook's signature doesn't verify — the payload is
    not trusted as genuinely from the gateway and must not be acted on."""


@transaction.atomic
def verify_and_record_payment(raw_body: bytes, signature: str, gateway_order_id: str) -> PaymentOrder:
    """Verifies a gateway webhook's HMAC-SHA256 signature against the
    configured webhook secret, then — and only then — marks the matching
    PaymentOrder paid and posts a Receipt via the existing
    apps.sales.services.finalize_receipt, so a confirmed payment flows
    through the same outstanding-balance/payment-status logic as any
    manually-recorded receipt. Raises PaymentVerificationError (never
    silently accepts) on a signature mismatch."""
    connection = _active_connection()
    secret = connection.credentials.get("webhook_secret", "")
    if not secret:
        raise PaymentVerificationError("No webhook secret configured — cannot verify this callback.")

    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise PaymentVerificationError("Webhook signature does not match — payload rejected.")

    try:
        order = PaymentOrder.objects.select_for_update().get(gateway_order_id=gateway_order_id)
    except PaymentOrder.DoesNotExist:
        raise PaymentVerificationError(f"No PaymentOrder for gateway_order_id={gateway_order_id!r}.")

    if order.status == PaymentOrder.STATUS_PAID:
        return order  # already recorded — a retried webhook must not double-post a receipt

    from apps.sales.services import finalize_receipt

    receipt = Receipt.objects.create(
        customer=order.invoice.customer, agent=order.invoice.agent, mode=Receipt.MODE_UPI,
        amount=order.amount, reference_no=order.gateway_order_id,
        received_at=timezone.now(),
    )
    from apps.sales.models import PaymentAllocation

    PaymentAllocation.objects.create(receipt=receipt, invoice=order.invoice, amount=order.amount)
    finalize_receipt(receipt)

    order.status = PaymentOrder.STATUS_PAID
    order.receipt = receipt
    order.save(update_fields=["status", "receipt"])
    return order
