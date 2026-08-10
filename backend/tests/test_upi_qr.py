"""§18 UPI QR at point of sale: build_upi_uri()'s payee/amount encoding,
the InvoiceViewSet upi-qr endpoint (available vs. unavailable), that
Company.upi_vpa is editable only via the governance propose/approve
workflow (same lock-down as legal_name/display_name), and that the
mobile_sync pull payload carries the company config offline-first
billing needs it for."""

from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.accounts.constants import ROLE_BACK_OFFICE_ADMIN
from apps.accounts.models import Role, User, UserRole
from apps.sales.models import Invoice
from apps.sales.upi_qr import build_upi_uri


@pytest.fixture
def back_office_admin(db):
    Role.seed_defaults()
    role = Role.objects.get(name=ROLE_BACK_OFFICE_ADMIN)
    user = User.objects.create_user(username="boadmin2@test.local", password="testpass123")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def invoice(company, agent, van_godown, customer):
    _, gst_registration = company
    return Invoice.objects.create(
        invoice_no="INV-UPI-1", customer=customer, agent=agent, godown=van_godown,
        gst_registration=gst_registration, place_of_supply_state=gst_registration.state,
        invoice_date=date.today(), subtotal=Decimal("1000"), grand_total=Decimal("1180"),
    )


# ---- build_upi_uri ----


@pytest.mark.django_db
def test_build_upi_uri_returns_none_without_vpa(invoice):
    assert build_upi_uri(invoice) is None


@pytest.mark.django_db
def test_build_upi_uri_encodes_payee_amount_and_note(invoice):
    company_obj = invoice.gst_registration.company
    company_obj.upi_vpa = "distributor@okhdfcbank"
    company_obj.display_name = "Test Distributors Pvt Ltd"
    company_obj.save(update_fields=["upi_vpa", "display_name"])

    uri = build_upi_uri(invoice)
    assert uri.startswith("upi://pay?")
    assert "pa=distributor%40okhdfcbank" in uri
    assert "am=1180.00" in uri
    assert "cu=INR" in uri
    assert "Test+Distributors" in uri or "Test%20Distributors" in uri
    assert "INV-UPI-1" in uri


# ---- InvoiceViewSet upi-qr action ----


@pytest.mark.django_db
def test_upi_qr_action_unavailable_without_vpa(supervisor, invoice):
    client = APIClient()
    client.force_authenticate(user=supervisor)
    response = client.get(f"/api/sales/invoices/{invoice.id}/upi-qr/")
    assert response.status_code == 200
    assert response.data["available"] is False
    assert response.data["upi_uri"] is None


@pytest.mark.django_db
def test_upi_qr_action_available_with_vpa(supervisor, invoice):
    company_obj = invoice.gst_registration.company
    company_obj.upi_vpa = "distributor@okhdfcbank"
    company_obj.save(update_fields=["upi_vpa"])

    client = APIClient()
    client.force_authenticate(user=supervisor)
    response = client.get(f"/api/sales/invoices/{invoice.id}/upi-qr/")
    assert response.status_code == 200
    assert response.data["available"] is True
    assert response.data["vpa"] == "distributor@okhdfcbank"
    assert response.data["upi_uri"].startswith("upi://pay?")


@pytest.mark.django_db
def test_invoice_pdf_renders_with_and_without_vpa(supervisor, invoice):
    """Guards against the QR embedding breaking PDF generation either
    way — see apps.sales.invoice_pdf.build_invoice_pdf_bytes."""
    client = APIClient()
    client.force_authenticate(user=supervisor)

    response = client.get(f"/api/sales/invoices/{invoice.id}/pdf/")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"

    company_obj = invoice.gst_registration.company
    company_obj.upi_vpa = "distributor@okhdfcbank"
    company_obj.save(update_fields=["upi_vpa"])

    response = client.get(f"/api/sales/invoices/{invoice.id}/pdf/")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"


# ---- governance: upi_vpa is a governed field ----


@pytest.mark.django_db
def test_upi_vpa_is_read_only_on_company_api(supervisor, company):
    company_obj, _ = company
    client = APIClient()
    client.force_authenticate(user=supervisor)
    response = client.patch(f"/api/company/companies/{company_obj.id}/", {"upi_vpa": "hack@bank"}, format="json")
    company_obj.refresh_from_db()
    assert company_obj.upi_vpa != "hack@bank"


@pytest.mark.django_db
def test_upi_vpa_change_goes_through_governance_approval(back_office_admin, company):
    company_obj, _ = company
    client = APIClient()
    client.force_authenticate(user=back_office_admin)

    propose_response = client.post(
        "/api/governance/change-requests/",
        {
            "target_type": "company", "target_id": str(company_obj.id),
            "proposed_changes": {"upi_vpa": "distributor@okhdfcbank"}, "reason": "enable UPI QR",
        },
        format="json",
    )
    assert propose_response.status_code == 201, propose_response.data
    company_obj.refresh_from_db()
    assert company_obj.upi_vpa == ""  # not applied until approved

    approve_response = client.post(
        f"/api/governance/change-requests/{propose_response.data['id']}/approve/", {}, format="json"
    )
    assert approve_response.status_code == 200, approve_response.data
    company_obj.refresh_from_db()
    assert company_obj.upi_vpa == "distributor@okhdfcbank"


# ---- mobile_sync pull payload ----


@pytest.mark.django_db
def test_pull_payload_includes_company_config(agent, company):
    company_obj, _ = company
    company_obj.upi_vpa = "distributor@okhdfcbank"
    company_obj.save(update_fields=["upi_vpa"])

    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get("/api/sync/pull/")
    assert response.status_code == 200
    assert response.data["company"]["upi_vpa"] == "distributor@okhdfcbank"
    assert response.data["company"]["legal_name"] == company_obj.legal_name


@pytest.mark.django_db
def test_pull_payload_company_defaults_blank_when_no_company_row(agent):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get("/api/sync/pull/")
    assert response.status_code == 200
    assert response.data["company"] == {"legal_name": "", "display_name": "", "upi_vpa": ""}
