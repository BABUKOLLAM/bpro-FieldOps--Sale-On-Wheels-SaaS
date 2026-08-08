import hashlib
import hmac
import json
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.core.exceptions import DomainError
from apps.payments.models import PaymentGatewayConnection, PaymentOrder
from apps.payments.services import (
    PaymentVerificationError, create_payment_order, verify_and_record_payment,
)
from apps.sales.models import Invoice, InvoiceLine
from apps.sales.services import finalize_invoice


def _make_invoice(company, agent, van_godown, item, customer):
    _, gst_registration = company
    invoice = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=invoice, item=item, qty=Decimal("1"), rate=Decimal("100.00"))
    finalize_invoice(invoice)
    return invoice


@pytest.mark.django_db
def test_create_payment_order_defaults_to_inert_mock_mode(company, agent, van_godown, item, customer):
    """No gateway configured (the default) -> no network call is possible
    (there's no gateway URL to call), and the order is unmistakably
    tagged 'mock' so nothing downstream can confuse it for a real one."""
    invoice = _make_invoice(company, agent, van_godown, item, customer)

    order = create_payment_order(invoice, Decimal("118.00"))

    assert order.gateway_type == PaymentGatewayConnection.GATEWAY_MOCK
    assert order.gateway_order_id.startswith("MOCK-ORDER-")
    assert order.status == PaymentOrder.STATUS_CREATED
    assert order.amount == Decimal("118.00")


@pytest.mark.django_db
def test_create_payment_order_rejects_non_positive_amount(company, agent, van_godown, item, customer):
    invoice = _make_invoice(company, agent, van_godown, item, customer)
    with pytest.raises(DomainError, match="must be positive"):
        create_payment_order(invoice, Decimal("0"))


@pytest.mark.django_db
def test_razorpay_selected_but_not_configured_raises_instead_of_silently_falling_back(
    company, agent, van_godown, item, customer
):
    """A half-configured real gateway must fail loudly, not silently
    behave like mock mode (which would mask a broken production setup)."""
    PaymentGatewayConnection.objects.create(gateway_type=PaymentGatewayConnection.GATEWAY_RAZORPAY, is_active=True)
    invoice = _make_invoice(company, agent, van_godown, item, customer)

    with pytest.raises(DomainError, match="not configured"):
        create_payment_order(invoice, Decimal("100.00"))


@pytest.mark.django_db
def test_verify_and_record_payment_rejects_bad_signature(company, agent, van_godown, item, customer):
    connection = PaymentGatewayConnection.objects.create(gateway_type=PaymentGatewayConnection.GATEWAY_MOCK, is_active=True)
    connection.credentials = {"webhook_secret": "real-secret"}
    connection.save()
    invoice = _make_invoice(company, agent, van_godown, item, customer)
    order = create_payment_order(invoice, Decimal("100.00"))

    with pytest.raises(PaymentVerificationError, match="does not match"):
        verify_and_record_payment(b'{"order_id": "x"}', "wrong-signature", order.gateway_order_id)

    order.refresh_from_db()
    assert order.status == PaymentOrder.STATUS_CREATED  # untouched by the rejected attempt


@pytest.mark.django_db
def test_verify_and_record_payment_requires_configured_secret(company, agent, van_godown, item, customer):
    invoice = _make_invoice(company, agent, van_godown, item, customer)
    order = create_payment_order(invoice, Decimal("100.00"))

    with pytest.raises(PaymentVerificationError, match="No webhook secret"):
        verify_and_record_payment(b"{}", "anything", order.gateway_order_id)


@pytest.mark.django_db
def test_verify_and_record_payment_marks_paid_and_posts_receipt(company, agent, van_godown, item, customer):
    connection = PaymentGatewayConnection.objects.create(gateway_type=PaymentGatewayConnection.GATEWAY_MOCK, is_active=True)
    connection.credentials = {"webhook_secret": "real-secret"}
    connection.save()
    invoice = _make_invoice(company, agent, van_godown, item, customer)
    order = create_payment_order(invoice, Decimal("118.00"))

    body = json.dumps({"order_id": order.gateway_order_id}).encode()
    signature = hmac.new(b"real-secret", body, hashlib.sha256).hexdigest()

    result = verify_and_record_payment(body, signature, order.gateway_order_id)

    assert result.status == PaymentOrder.STATUS_PAID
    assert result.receipt is not None
    assert result.receipt.amount == Decimal("118.00")
    assert result.receipt.mode == "upi"

    invoice.refresh_from_db()
    assert invoice.payment_status in (Invoice.PAYMENT_PAID, Invoice.PAYMENT_PARTIAL)


@pytest.mark.django_db
def test_verify_and_record_payment_is_idempotent_on_retried_webhook(company, agent, van_godown, item, customer):
    """A gateway retrying the same webhook (common — at-least-once
    delivery) must not post a second receipt for the same payment."""
    connection = PaymentGatewayConnection.objects.create(gateway_type=PaymentGatewayConnection.GATEWAY_MOCK, is_active=True)
    connection.credentials = {"webhook_secret": "real-secret"}
    connection.save()
    invoice = _make_invoice(company, agent, van_godown, item, customer)
    order = create_payment_order(invoice, Decimal("100.00"))

    body = json.dumps({"order_id": order.gateway_order_id}).encode()
    signature = hmac.new(b"real-secret", body, hashlib.sha256).hexdigest()

    verify_and_record_payment(body, signature, order.gateway_order_id)
    verify_and_record_payment(body, signature, order.gateway_order_id)

    order.refresh_from_db()
    assert order.invoice.payment_orders.filter(status=PaymentOrder.STATUS_PAID).count() == 1
    from apps.sales.models import Receipt

    assert Receipt.objects.filter(reference_no=order.gateway_order_id).count() == 1


@pytest.mark.django_db
def test_payment_order_api_agent_can_create_for_own_invoice(agent, company, van_godown, item, customer):
    invoice = _make_invoice(company, agent, van_godown, item, customer)
    client = APIClient()
    client.force_authenticate(user=agent)

    response = client.post(
        "/api/payments/orders/", {"invoice": str(invoice.id), "amount": "118.00"}, format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data["gateway_order_id"].startswith("MOCK-ORDER-")


@pytest.mark.django_db
def test_payment_order_api_agent_cannot_create_for_others_invoice(agent, supervisor, company, van_godown, item, customer):
    invoice = _make_invoice(company, supervisor, van_godown, item, customer)
    client = APIClient()
    client.force_authenticate(user=agent)

    response = client.post(
        "/api/payments/orders/", {"invoice": str(invoice.id), "amount": "118.00"}, format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_payment_webhook_endpoint_rejects_unsigned_request():
    client = APIClient()
    response = client.post("/api/payments/webhook/", {"order_id": "MOCK-ORDER-doesnotexist"}, format="json")
    assert response.status_code == 400
