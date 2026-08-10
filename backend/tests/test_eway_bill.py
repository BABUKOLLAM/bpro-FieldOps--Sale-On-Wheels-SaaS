"""GST e-way bill generation: threshold check, payload correctness, the
draft/never-fake-a-real-EWB-number guarantee, PDF download, and
governance-gated threshold settings."""

from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.sales.eway_bill import eway_bill_required
from apps.sales.models import EwayBill, EwayBillSettings, Invoice, InvoiceLine
from apps.sales.services import finalize_invoice


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
    _, gst_registration = company
    inv = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=inv, item=item, qty=Decimal("10"), rate=Decimal("6000.00"))
    finalize_invoice(inv)
    return inv


@pytest.mark.django_db
def test_eway_bill_required_below_and_above_threshold(invoice):
    EwayBillSettings.objects.all().delete()  # force get_solo() to (re)create with the default threshold
    settings_obj = EwayBillSettings.get_solo()
    assert settings_obj.threshold_amount == Decimal("50000")

    invoice.grand_total = Decimal("40000")
    assert eway_bill_required(invoice) is False

    invoice.grand_total = Decimal("60000")
    assert eway_bill_required(invoice) is True


@pytest.mark.django_db
def test_eway_bill_not_required_when_settings_inactive(invoice):
    settings_obj = EwayBillSettings.get_solo()
    settings_obj.is_active = False
    settings_obj.save()
    invoice.grand_total = Decimal("999999")
    assert eway_bill_required(invoice) is False


@pytest.mark.django_db
def test_generate_eway_bill_via_api_builds_correct_payload(agent, invoice):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.post(
        f"/api/sales/invoices/{invoice.id}/eway-bill/",
        {
            "transport_mode": "road", "vehicle_no": "MH-04-AB-1234",
            "transporter_id": "27ABCDE1234F1Z5", "transporter_name": "Fast Transporters",
            "distance_km": 250,
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["status"] == EwayBill.STATUS_DRAFT
    assert response.data["vehicle_no"] == "MH-04-AB-1234"
    assert response.data["ewb_number"] == ""  # never fabricated

    payload = response.data["payload"]
    assert payload["docNo"] == invoice.invoice_no or invoice.invoice_no == ""
    assert payload["vehicleNo"] == "MH-04-AB-1234"
    assert payload["transDistance"] == "250"
    assert len(payload["itemList"]) == 1
    assert payload["itemList"][0]["taxableAmount"] > 0
    assert payload["totInvValue"] == float(invoice.grand_total)


@pytest.mark.django_db
def test_generate_eway_bill_twice_upserts_not_duplicates(agent, invoice):
    client = APIClient()
    client.force_authenticate(user=agent)
    client.post(f"/api/sales/invoices/{invoice.id}/eway-bill/", {"vehicle_no": "MH-01"}, format="json")
    client.post(f"/api/sales/invoices/{invoice.id}/eway-bill/", {"vehicle_no": "MH-02"}, format="json")
    assert EwayBill.objects.filter(invoice=invoice).count() == 1
    assert EwayBill.objects.get(invoice=invoice).vehicle_no == "MH-02"


@pytest.mark.django_db
def test_get_eway_bill_before_generation_404s(agent, invoice):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get(f"/api/sales/invoices/{invoice.id}/eway-bill/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_get_eway_bill_after_generation_returns_it(agent, invoice):
    client = APIClient()
    client.force_authenticate(user=agent)
    client.post(f"/api/sales/invoices/{invoice.id}/eway-bill/", {"vehicle_no": "MH-01"}, format="json")
    response = client.get(f"/api/sales/invoices/{invoice.id}/eway-bill/")
    assert response.status_code == 200
    assert response.data["vehicle_no"] == "MH-01"


@pytest.mark.django_db
def test_eway_bill_pdf_download(agent, invoice):
    client = APIClient()
    client.force_authenticate(user=agent)
    client.post(f"/api/sales/invoices/{invoice.id}/eway-bill/", {"vehicle_no": "MH-01"}, format="json")
    response = client.get(f"/api/sales/invoices/{invoice.id}/eway-bill-pdf/")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


@pytest.mark.django_db
def test_eway_bill_pdf_before_generation_404s(agent, invoice):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get(f"/api/sales/invoices/{invoice.id}/eway-bill-pdf/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_eway_bill_settings_direct_write_locked_down(admin):
    settings_obj = EwayBillSettings.get_solo()
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.patch(
        f"/api/sales/eway-bill-settings/{settings_obj.id}/", {"threshold_amount": "10000"}, format="json",
    )
    assert response.status_code == 405


@pytest.mark.django_db
def test_eway_bill_settings_change_requires_governance_approval(admin, back_office_admin):
    settings_obj = EwayBillSettings.get_solo()
    client = APIClient()
    client.force_authenticate(user=admin)

    propose_response = _propose(client, "eway-bill-settings", settings_obj.id, {"threshold_amount": "25000"})
    assert propose_response.status_code == 201, propose_response.data

    settings_obj.refresh_from_db()
    assert settings_obj.threshold_amount == Decimal("50000")  # unchanged until approved

    approver_client = APIClient()
    approver_client.force_authenticate(user=back_office_admin)
    approve_response = _approve(approver_client, propose_response.data["id"])
    assert approve_response.status_code == 200

    settings_obj.refresh_from_db()
    assert settings_obj.threshold_amount == Decimal("25000")


@pytest.mark.django_db
def test_eway_bill_settings_requires_master_settings_permission(agent):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get("/api/sales/eway-bill-settings/")
    assert response.status_code == 403
