from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.accounts.constants import ROLE_VAN_SALESMAN
from apps.accounts.models import Role
from apps.reporting.models import Target


@pytest.mark.django_db
def test_user_created_via_api_can_login(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.post(
        "/api/users/",
        {"username": "newhire@test.local", "first_name": "New", "password": "hirepass123"},
        format="json",
    )
    assert response.status_code == 201, response.data

    login_client = APIClient()
    login_response = login_client.post(
        "/api/auth/login/", {"username": "newhire@test.local", "password": "hirepass123"}, format="json"
    )
    assert login_response.status_code == 200
    assert login_response.data["user"]["username"] == "newhire@test.local"


@pytest.mark.django_db
def test_user_created_without_password_cannot_login(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.post("/api/users/", {"username": "nopass@test.local"}, format="json")
    assert response.status_code == 201, response.data

    login_client = APIClient()
    login_response = login_client.post(
        "/api/auth/login/", {"username": "nopass@test.local", "password": ""}, format="json"
    )
    assert login_response.status_code in (400, 401)


@pytest.mark.django_db
def test_role_permission_update_via_api(admin):
    Role.seed_defaults()
    role = Role.objects.get(name=ROLE_VAN_SALESMAN)
    original_perms = set(role.permissions)

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.patch(f"/api/roles/{role.id}/", {"permissions": ["sales.invoice.create"]}, format="json")
    assert response.status_code == 200, response.data

    role.refresh_from_db()
    assert role.permissions == ["sales.invoice.create"]
    assert role.permissions != list(original_perms) or len(original_perms) == 1


@pytest.mark.django_db
def test_report_export_returns_xlsx(admin, customer, agent, company, van_godown):
    from apps.sales.models import Invoice

    _, gst = company
    Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst,
        place_of_supply_state=gst.state, invoice_date=date.today(), grand_total=Decimal("1000"),
    )

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get("/api/reporting/export/sales/?filetype=xlsx")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert response.content[:2] == b"PK"  # xlsx is a zip archive


@pytest.mark.django_db
def test_report_export_returns_pdf(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get("/api/reporting/export/expenses/?filetype=pdf")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response.content[:4] == b"%PDF"


@pytest.mark.django_db
def test_report_export_unknown_key_404s(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get("/api/reporting/export/not-a-real-report/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_report_email_sends_via_console_backend(admin, mailoutbox):
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.post(
        "/api/reporting/export/expenses/email/", {"to": "manager@test.local", "filetype": "pdf"}, format="json"
    )
    assert response.status_code == 200, response.data
    assert response.data["status"] == "sent"
    assert len(mailoutbox) == 1
    assert mailoutbox[0].to == ["manager@test.local"]
    assert len(mailoutbox[0].attachments) == 1


@pytest.mark.django_db
def test_target_achieved_amount_computed_from_invoices(agent, van_godown, customer, company):
    from apps.sales.models import Invoice

    _, gst = company
    Target.objects.create(
        agent=agent, metric=Target.METRIC_SALES,
        period_start=date.today().replace(day=1), period_end=date.today(),
        target_amount=Decimal("10000"),
    )
    Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst,
        place_of_supply_state=gst.state, invoice_date=date.today(), grand_total=Decimal("2500"),
    )

    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get("/api/reporting/targets/")
    assert response.status_code == 200
    results = response.data["results"] if isinstance(response.data, dict) and "results" in response.data else response.data
    assert Decimal(results[0]["achieved_amount"]) == Decimal("2500")
