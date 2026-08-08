"""Phase 4 — branding/logo, GST invoice PDF, trip-plan templates, and
DB-backed message templates."""

import io
from datetime import date
from decimal import Decimal

import pytest
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.constants import ROLE_VAN_SALESMAN
from apps.accounts.models import Role, User, UserRole
from apps.customers.models import Beat, BeatTemplate, BeatTemplateStop
from apps.expenses.models import Expense
from apps.notifications.models import MessageTemplate, NotificationLog
from apps.notifications.services import render_template
from apps.sales.models import Invoice, InvoiceLine
from apps.sales.services import finalize_invoice


def _png_upload(name="logo.png"):
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), color="blue").save(buf, format="PNG")
    buf.seek(0)
    buf.name = name
    return buf


# ---- Company logo ----


@pytest.mark.django_db
def test_company_logo_upload(admin, company):
    company_obj, _ = company
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post(
        f"/api/company/companies/{company_obj.id}/upload_logo/", {"logo": _png_upload()}, format="multipart",
    )
    assert response.status_code == 200, response.data

    company_obj.refresh_from_db()
    assert company_obj.logo.name.startswith("branding/")


@pytest.mark.django_db
def test_company_logo_upload_requires_a_file(admin, company):
    company_obj, _ = company
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post(f"/api/company/companies/{company_obj.id}/upload_logo/", {}, format="multipart")
    assert response.status_code == 400


@pytest.mark.django_db
def test_company_direct_field_edits_still_blocked_after_adding_logo(admin, company):
    """Locking in that adding a direct-write action (upload_logo) didn't
    accidentally reopen the other fields to direct PATCH."""
    company_obj, _ = company
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.patch(f"/api/company/companies/{company_obj.id}/", {"legal_name": "New"}, format="json")
    assert response.status_code == 405


# ---- GST invoice PDF ----


def _finalized_invoice(company, agent, van_godown, item, customer):
    _, gst_registration = company
    invoice = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=invoice, item=item, qty=Decimal("2"), rate=Decimal("100.00"))
    finalize_invoice(invoice)
    return invoice


@pytest.mark.django_db
def test_invoice_pdf_download(company, agent, van_godown, item, customer):
    invoice = _finalized_invoice(company, agent, van_godown, item, customer)

    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get(f"/api/sales/invoices/{invoice.id}/pdf/")

    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    content = b"".join(response.streaming_content) if response.streaming else response.content
    assert content.startswith(b"%PDF")


@pytest.mark.django_db
def test_invoice_pdf_scoped_to_own_agent(company, agent, van_godown, item, customer):
    invoice = _finalized_invoice(company, agent, van_godown, item, customer)

    Role.seed_defaults()
    other_role = Role.objects.get(name=ROLE_VAN_SALESMAN)
    other_agent = User.objects.create_user(username="other-agent@test.local", password="testpass123")
    UserRole.objects.create(user=other_agent, role=other_role)

    client = APIClient()
    client.force_authenticate(user=other_agent)
    response = client.get(f"/api/sales/invoices/{invoice.id}/pdf/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_invoice_pdf_visible_to_supervisor(company, agent, van_godown, item, customer, supervisor):
    invoice = _finalized_invoice(company, agent, van_godown, item, customer)

    client = APIClient()
    client.force_authenticate(user=supervisor)
    response = client.get(f"/api/sales/invoices/{invoice.id}/pdf/")
    assert response.status_code == 200


# ---- Trip-plan (Beat) templates ----


@pytest.mark.django_db
def test_beat_template_instantiate_creates_a_new_beat(admin, customer):
    from apps.customers.models import Customer

    second_customer = Customer.objects.create(
        code="CUST-TEST-2", name="Second Customer", credit_limit=Decimal("5000"), credit_days=15,
    )
    template = BeatTemplate.objects.create(name="Weekly North Route")
    BeatTemplateStop.objects.create(template=template, customer=customer, visit_sequence=2)
    BeatTemplateStop.objects.create(template=template, customer=second_customer, visit_sequence=1)

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.post(f"/api/customers/beat-templates/{template.id}/instantiate/", {}, format="json")
    assert response.status_code == 201, response.data

    beat = Beat.objects.get(pk=response.data["id"])
    assert list(beat.stops.order_by("visit_sequence").values_list("customer_id", "visit_sequence")) == [
        (second_customer.id, 1), (customer.id, 2),
    ]
    # The template itself is untouched — still just a template, not a Beat.
    assert BeatTemplate.objects.filter(pk=template.id).exists()
    assert template.stops.count() == 2


@pytest.mark.django_db
def test_beat_template_instantiate_accepts_agent_and_name(admin, agent, customer):
    template = BeatTemplate.objects.create(name="Blank Route")
    BeatTemplateStop.objects.create(template=template, customer=customer, visit_sequence=1)

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.post(
        f"/api/customers/beat-templates/{template.id}/instantiate/",
        {"name": "Monday Run", "assigned_agent": str(agent.id)}, format="json",
    )
    assert response.status_code == 201
    beat = Beat.objects.get(pk=response.data["id"])
    assert beat.name == "Monday Run"
    assert beat.assigned_agent_id == agent.id


# ---- Message templates ----


@pytest.mark.django_db
def test_render_template_falls_back_to_hardcoded_default_when_no_row_exists():
    assert not MessageTemplate.objects.exists()
    title, body = render_template(MessageTemplate.KEY_EXPENSE_APPROVED, category="fuel", amount=Decimal("150.00"))
    assert title == "Expense approved"
    assert "fuel" in body and "150.00" in body


@pytest.mark.django_db
def test_message_template_list_api_auto_seeds_defaults(admin):
    assert not MessageTemplate.objects.exists()
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get("/api/notifications/message-templates/")
    assert response.status_code == 200
    keys = {row["key"] for row in response.data["results"]}
    assert keys == {
        MessageTemplate.KEY_EXPENSE_APPROVED, MessageTemplate.KEY_EXPENSE_REJECTED, MessageTemplate.KEY_DELIVERY_OTP,
    }


@pytest.mark.django_db
def test_message_template_edit_requires_governance_approval(admin, back_office_admin):
    MessageTemplate.seed_defaults()
    template = MessageTemplate.objects.get(key=MessageTemplate.KEY_EXPENSE_APPROVED)

    client = APIClient()
    client.force_authenticate(user=admin)

    direct = client.patch(
        f"/api/notifications/message-templates/{template.id}/", {"body_template": "New body"}, format="json",
    )
    assert direct.status_code == 405

    propose_response = client.post(
        "/api/governance/change-requests/",
        {
            "target_type": "message-template", "target_id": str(template.id),
            "proposed_changes": {"body_template": "Nice work — your {category} claim of Rs.{amount} is approved!"},
        },
        format="json",
    )
    assert propose_response.status_code == 201, propose_response.data

    approver_client = APIClient()
    approver_client.force_authenticate(user=back_office_admin)
    approve_response = approver_client.post(
        f"/api/governance/change-requests/{propose_response.data['id']}/approve/", format="json"
    )
    assert approve_response.status_code == 200

    template.refresh_from_db()
    assert template.body_template == "Nice work — your {category} claim of Rs.{amount} is approved!"


@pytest.mark.django_db
def test_edited_message_template_is_actually_used_by_expense_approval(back_office_admin, agent):
    MessageTemplate.objects.update_or_create(
        key=MessageTemplate.KEY_EXPENSE_APPROVED,
        defaults={"title_template": "Approved!", "body_template": "Custom: {category}/{amount}"},
    )
    expense = Expense.objects.create(
        agent=agent, category=Expense.CATEGORY_FUEL, amount=Decimal("75.00"), expense_date=date.today(),
    )

    client = APIClient()
    client.force_authenticate(user=back_office_admin)
    response = client.post(f"/api/expenses/{expense.id}/approve/", format="json")
    assert response.status_code == 200

    log = NotificationLog.objects.filter(user=agent).latest("created_at")
    assert log.title == "Approved!"
    assert log.body == "Custom: fuel/75.00"
