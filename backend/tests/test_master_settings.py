"""Phase 3 — Master Settings: propose/approve coverage for every
newly-governed model (Company, GSTRegistration, ERPConnection,
PaymentGatewayConnection, Webhook, NotificationGatewaySettings). The
generic propose/approve/reject machinery itself is already covered by
tests/test_governance.py — these tests focus on what's specific to each
new target: the governed-field allowlist, the read-only lock-down of the
direct viewsets, and (for NotificationGatewaySettings) the DB-then-env
fallback in apps.notifications.services."""

import pytest
from rest_framework.test import APIClient

from apps.company.models import Company, GSTRegistration
from apps.integrations.models import ERPConnection, Webhook
from apps.notifications.models import NotificationGatewaySettings
from apps.notifications.services import _resolve_gateway_setting
from apps.payments.models import PaymentGatewayConnection


def _propose(client, target_type, target_id, changes, reason=""):
    return client.post(
        "/api/governance/change-requests/",
        {"target_type": target_type, "target_id": str(target_id), "proposed_changes": changes, "reason": reason},
        format="json",
    )


def _approve(client, change_request_id):
    return client.post(f"/api/governance/change-requests/{change_request_id}/approve/", format="json")


# ---- Company / GSTRegistration ----


@pytest.mark.django_db
def test_company_edits_require_governance_approval(admin, back_office_admin, company):
    company_obj, gst = company
    client = APIClient()
    client.force_authenticate(user=admin)

    direct = client.patch(f"/api/company/companies/{company_obj.id}/", {"legal_name": "New Name"}, format="json")
    assert direct.status_code == 405

    propose_response = _propose(client, "company", company_obj.id, {"legal_name": "New Legal Name"})
    assert propose_response.status_code == 201, propose_response.data

    approver_client = APIClient()
    approver_client.force_authenticate(user=back_office_admin)
    approve_response = _approve(approver_client, propose_response.data["id"])
    assert approve_response.status_code == 200

    company_obj.refresh_from_db()
    assert company_obj.legal_name == "New Legal Name"


@pytest.mark.django_db
def test_gst_registration_edit_requires_approval(admin, back_office_admin, company):
    _, gst = company
    client = APIClient()
    client.force_authenticate(user=admin)

    propose_response = _propose(client, "gst-registration", gst.id, {"city": "Pune"})
    assert propose_response.status_code == 201, propose_response.data
    assert propose_response.data["previous_snapshot"] == {"city": gst.city}

    approver_client = APIClient()
    approver_client.force_authenticate(user=back_office_admin)
    approve_response = _approve(approver_client, propose_response.data["id"])
    assert approve_response.status_code == 200

    gst.refresh_from_db()
    assert gst.city == "Pune"


# ---- ERPConnection ----


@pytest.mark.django_db
def test_erp_connection_viewset_is_read_only(admin):
    connection = ERPConnection.objects.create()
    client = APIClient()
    client.force_authenticate(user=admin)

    direct = client.patch(
        f"/api/integrations/erp-connections/{connection.id}/", {"sync_mode": "realtime"}, format="json"
    )
    assert direct.status_code == 405


@pytest.mark.django_db
def test_erp_connection_sync_mode_change_requires_approval(admin, back_office_admin):
    connection = ERPConnection.objects.create(sync_mode=ERPConnection.SYNC_BATCH)
    client = APIClient()
    client.force_authenticate(user=admin)

    propose_response = _propose(client, "erp-connection", connection.id, {"sync_mode": ERPConnection.SYNC_REALTIME})
    assert propose_response.status_code == 201, propose_response.data

    approver_client = APIClient()
    approver_client.force_authenticate(user=back_office_admin)
    approve_response = _approve(approver_client, propose_response.data["id"])
    assert approve_response.status_code == 200

    connection.refresh_from_db()
    assert connection.sync_mode == ERPConnection.SYNC_REALTIME


@pytest.mark.django_db
def test_erp_connection_credentials_cannot_be_proposed(admin):
    connection = ERPConnection.objects.create()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = _propose(client, "erp-connection", connection.id, {"credentials": {"api_key": "leaked"}})
    assert response.status_code == 400
    assert "proposed_changes" in response.data


# ---- Webhook ----


@pytest.mark.django_db
def test_webhook_can_still_be_created_and_deleted_directly(back_office_admin):
    client = APIClient()
    client.force_authenticate(user=back_office_admin)

    create_response = client.post(
        "/api/integrations/webhooks/",
        {
            "name": "Order System", "url": "https://example.com/hook", "secret": "s3cret",
            "event_types": [Webhook.EVENT_INVOICE_FINALIZED],
        },
        format="json",
    )
    assert create_response.status_code == 201, create_response.data
    assert "secret" not in create_response.data  # write-only

    webhook_id = create_response.data["id"]
    delete_response = client.delete(f"/api/integrations/webhooks/{webhook_id}/")
    assert delete_response.status_code == 204


@pytest.mark.django_db
def test_webhook_update_now_requires_approval_not_direct_patch(admin, back_office_admin):
    webhook = Webhook.objects.create(
        name="Old Name", url="https://example.com/old", secret="s3cret",
        event_types=[Webhook.EVENT_INVOICE_FINALIZED],
    )
    client = APIClient()
    client.force_authenticate(user=admin)

    direct = client.patch(f"/api/integrations/webhooks/{webhook.id}/", {"name": "New Name"}, format="json")
    assert direct.status_code == 405

    propose_response = _propose(client, "webhook", webhook.id, {"name": "New Name"})
    assert propose_response.status_code == 201, propose_response.data

    approver_client = APIClient()
    approver_client.force_authenticate(user=back_office_admin)
    approve_response = _approve(approver_client, propose_response.data["id"])
    assert approve_response.status_code == 200

    webhook.refresh_from_db()
    assert webhook.name == "New Name"


@pytest.mark.django_db
def test_webhook_secret_cannot_be_proposed_but_can_be_rotated_directly(back_office_admin):
    webhook = Webhook.objects.create(
        name="Rotate Me", url="https://example.com/hook", secret="original-secret",
        event_types=[Webhook.EVENT_INVOICE_FINALIZED],
    )
    client = APIClient()
    client.force_authenticate(user=back_office_admin)

    propose_response = _propose(client, "webhook", webhook.id, {"secret": "hijacked"})
    assert propose_response.status_code == 400

    rotate_response = client.post(f"/api/integrations/webhooks/{webhook.id}/rotate_secret/", format="json")
    assert rotate_response.status_code == 200
    webhook.refresh_from_db()
    assert webhook.secret != "original-secret"
    assert webhook.secret  # non-empty, auto-generated


# ---- PaymentGatewayConnection ----


@pytest.mark.django_db
def test_payment_gateway_connection_edit_requires_approval(admin, back_office_admin):
    connection = PaymentGatewayConnection.objects.create(gateway_type=PaymentGatewayConnection.GATEWAY_MOCK)
    client = APIClient()
    client.force_authenticate(user=admin)

    direct = client.patch(
        f"/api/payments/gateway-connections/{connection.id}/",
        {"gateway_type": PaymentGatewayConnection.GATEWAY_RAZORPAY}, format="json",
    )
    assert direct.status_code == 405

    propose_response = _propose(
        client, "payment-gateway-connection", connection.id,
        {"gateway_type": PaymentGatewayConnection.GATEWAY_RAZORPAY},
    )
    assert propose_response.status_code == 201, propose_response.data

    approver_client = APIClient()
    approver_client.force_authenticate(user=back_office_admin)
    approve_response = _approve(approver_client, propose_response.data["id"])
    assert approve_response.status_code == 200

    connection.refresh_from_db()
    assert connection.gateway_type == PaymentGatewayConnection.GATEWAY_RAZORPAY


@pytest.mark.django_db
def test_payment_gateway_connections_list_requires_master_settings_permission(agent):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get("/api/payments/gateway-connections/")
    assert response.status_code == 403


# ---- NotificationGatewaySettings ----


@pytest.mark.django_db
def test_notification_gateway_settings_auto_provisions_singleton_row(admin):
    assert not NotificationGatewaySettings.objects.exists()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get("/api/notifications/gateway-settings/")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert NotificationGatewaySettings.objects.count() == 1


@pytest.mark.django_db
def test_notification_gateway_settings_never_exposes_raw_secrets(admin):
    settings_row = NotificationGatewaySettings.get_solo()
    settings_row.fcm_server_key = "super-secret-fcm-key"
    settings_row.save()

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get("/api/notifications/gateway-settings/")

    body = str(response.data)
    assert "super-secret-fcm-key" not in body
    assert response.data["results"][0]["has_fcm_server_key"] is True
    assert response.data["results"][0]["has_sms_gateway_api_key"] is False


@pytest.mark.django_db
def test_notification_gateway_sms_url_change_requires_approval(admin, back_office_admin):
    settings_row = NotificationGatewaySettings.get_solo()
    client = APIClient()
    client.force_authenticate(user=admin)

    propose_response = _propose(
        client, "notification-gateway-settings", settings_row.id,
        {"sms_gateway_url": "https://sms.example.com/send"},
    )
    assert propose_response.status_code == 201, propose_response.data

    approver_client = APIClient()
    approver_client.force_authenticate(user=back_office_admin)
    approve_response = _approve(approver_client, propose_response.data["id"])
    assert approve_response.status_code == 200

    settings_row.refresh_from_db()
    assert settings_row.sms_gateway_url == "https://sms.example.com/send"


@pytest.mark.django_db
def test_resolve_gateway_setting_prefers_db_value_over_env(settings):
    settings.SMS_GATEWAY_URL = "https://env-configured.example.com"
    assert not NotificationGatewaySettings.objects.exists()

    # No DB row yet -> falls back to the env var.
    assert _resolve_gateway_setting("sms_gateway_url", "SMS_GATEWAY_URL") == "https://env-configured.example.com"

    NotificationGatewaySettings.objects.create(sms_gateway_url="https://db-configured.example.com")
    assert _resolve_gateway_setting("sms_gateway_url", "SMS_GATEWAY_URL") == "https://db-configured.example.com"
