"""WhatsApp notifications channel: console-fallback delivery, the Cloud
API call shape, wiring into delivery OTP (dual SMS+WhatsApp) and the new
on-demand "invoice ready" notice, and governance-gated gateway settings."""

from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from apps.notifications.models import MessageTemplate, NotificationGatewaySettings, WhatsAppLog
from apps.notifications.services import send_whatsapp
from apps.sales.models import Invoice, InvoiceLine
from apps.sales.services import finalize_invoice, notify_invoice_ready_whatsapp, send_delivery_otp


def _propose(client, target_type, target_id, changes):
    return client.post(
        "/api/governance/change-requests/",
        {"target_type": target_type, "target_id": str(target_id), "proposed_changes": changes},
        format="json",
    )


def _approve(client, change_request_id):
    return client.post(f"/api/governance/change-requests/{change_request_id}/approve/", format="json")


@pytest.fixture
def invoice(company, agent, van_godown, item, customer):
    customer.phone = "9876543210"
    customer.save(update_fields=["phone"])
    _, gst_registration = company
    inv = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=inv, item=item, qty=Decimal("2"), rate=Decimal("100.00"))
    finalize_invoice(inv)
    return inv


@pytest.mark.django_db
def test_send_whatsapp_falls_back_to_console_without_gateway_configured(settings):
    settings.WHATSAPP_PHONE_NUMBER_ID = ""
    settings.WHATSAPP_ACCESS_TOKEN = ""
    log = send_whatsapp("919876543210", "Test message")
    assert log.channel == WhatsAppLog.CHANNEL_CONSOLE
    assert WhatsAppLog.objects.filter(phone="919876543210", message="Test message").exists()


@pytest.mark.django_db
@patch("apps.notifications.services.urllib.request.urlopen")
def test_send_whatsapp_calls_graph_api_when_configured(mock_urlopen, settings):
    settings.WHATSAPP_PHONE_NUMBER_ID = "1234567890"
    settings.WHATSAPP_ACCESS_TOKEN = "test-token"
    log = send_whatsapp("919876543210", "Hello there")

    assert log.channel == WhatsAppLog.CHANNEL_GATEWAY
    sent_request = mock_urlopen.call_args[0][0]
    assert sent_request.full_url == "https://graph.facebook.com/v19.0/1234567890/messages"
    assert sent_request.get_header("Authorization") == "Bearer test-token"
    assert b'"to": "919876543210"' in sent_request.data
    assert b'"body": "Hello there"' in sent_request.data


@pytest.mark.django_db
@patch("apps.notifications.services.urllib.request.urlopen")
def test_send_whatsapp_falls_back_to_console_on_network_error(mock_urlopen, settings):
    import urllib.error

    settings.WHATSAPP_PHONE_NUMBER_ID = "1234567890"
    settings.WHATSAPP_ACCESS_TOKEN = "test-token"
    mock_urlopen.side_effect = urllib.error.URLError("connection refused")

    log = send_whatsapp("919876543210", "Hello there")
    assert log.channel == WhatsAppLog.CHANNEL_CONSOLE


@pytest.mark.django_db
def test_delivery_otp_sends_via_both_sms_and_whatsapp(invoice):
    from apps.notifications.models import SmsLog

    send_delivery_otp(invoice)
    assert SmsLog.objects.filter(phone=invoice.customer.phone).exists()
    assert WhatsAppLog.objects.filter(phone=invoice.customer.phone).exists()


@pytest.mark.django_db
def test_notify_invoice_ready_whatsapp_requires_phone(company, agent, van_godown, item, customer):
    from apps.core.exceptions import DomainError

    customer.phone = ""
    customer.save(update_fields=["phone"])
    _, gst_registration = company
    inv = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=inv, item=item, qty=Decimal("1"), rate=Decimal("10.00"))
    finalize_invoice(inv)

    with pytest.raises(DomainError):
        notify_invoice_ready_whatsapp(inv)


@pytest.mark.django_db
def test_notify_invoice_ready_whatsapp_renders_expected_message(invoice):
    log = notify_invoice_ready_whatsapp(invoice)
    assert invoice.customer.name in log.message
    assert str(invoice.grand_total) in log.message or f"{invoice.grand_total:.2f}" in log.message


@pytest.mark.django_db
def test_notify_whatsapp_via_invoice_api_action(agent, invoice):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.post(f"/api/sales/invoices/{invoice.id}/notify-whatsapp/")
    assert response.status_code == 200, response.data
    assert response.data["sent"] is True
    assert WhatsAppLog.objects.filter(phone=invoice.customer.phone).exists()


@pytest.mark.django_db
def test_whatsapp_access_token_never_serialized(admin):
    settings_obj = NotificationGatewaySettings.get_solo()
    settings_obj.whatsapp_access_token = "super-secret-token"
    settings_obj.save()

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get("/api/notifications/gateway-settings/")
    assert response.status_code == 200
    body = str(response.data)
    assert "super-secret-token" not in body
    assert response.data["results"][0]["has_whatsapp_access_token"] is True


@pytest.mark.django_db
def test_whatsapp_phone_number_id_change_requires_governance_approval(admin, back_office_admin):
    settings_obj = NotificationGatewaySettings.get_solo()
    client = APIClient()
    client.force_authenticate(user=admin)

    propose_response = _propose(
        client, "notification-gateway-settings", settings_obj.id, {"whatsapp_phone_number_id": "9999999999"},
    )
    assert propose_response.status_code == 201, propose_response.data

    settings_obj.refresh_from_db()
    assert settings_obj.whatsapp_phone_number_id == ""

    approver_client = APIClient()
    approver_client.force_authenticate(user=back_office_admin)
    approve_response = _approve(approver_client, propose_response.data["id"])
    assert approve_response.status_code == 200

    settings_obj.refresh_from_db()
    assert settings_obj.whatsapp_phone_number_id == "9999999999"


@pytest.mark.django_db
def test_invoice_ready_whatsapp_template_seeded_with_default():
    MessageTemplate.seed_defaults()
    template = MessageTemplate.objects.get(key=MessageTemplate.KEY_INVOICE_READY_WHATSAPP)
    assert "{customer_name}" in template.body_template
    assert "{invoice_no}" in template.body_template
