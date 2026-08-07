from datetime import date
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.constants import ROLE_VAN_SALESMAN
from apps.accounts.models import Role
from apps.attendance.models import Attendance
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


@pytest.mark.django_db
def test_attendance_check_in_via_api_forces_agent(agent):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.post(
        "/api/attendance/", {"check_in_at": timezone.now().isoformat(), "check_in_latitude": "19.076000", "check_in_longitude": "72.877700"}, format="json"
    )
    assert response.status_code == 201, response.data
    assert str(response.data["agent"]) == str(agent.id)
    assert response.data["check_out_at"] is None


@pytest.mark.django_db
def test_attendance_duplicate_check_in_rejected(agent):
    Attendance.objects.create(agent=agent, check_in_at=timezone.now())
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.post("/api/attendance/", {"check_in_at": timezone.now().isoformat()}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_attendance_check_out_sets_duration(agent):
    record = Attendance.objects.create(agent=agent, check_in_at=timezone.now() - timezone.timedelta(hours=2))
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.post(f"/api/attendance/{record.id}/check_out/", {"latitude": "19.08", "longitude": "72.88"}, format="json")
    assert response.status_code == 200, response.data
    assert response.data["check_out_at"] is not None
    assert response.data["duration_minutes"] >= 119


@pytest.mark.django_db
def test_attendance_open_returns_current_record(agent):
    client = APIClient()
    client.force_authenticate(user=agent)
    assert client.get("/api/attendance/open/").data is None

    record = Attendance.objects.create(agent=agent, check_in_at=timezone.now())
    resp = client.get("/api/attendance/open/")
    assert resp.data["id"] == str(record.id)


@pytest.mark.django_db
def test_attendance_agent_cannot_see_others_but_supervisor_can(agent, supervisor):
    Attendance.objects.create(agent=agent, check_in_at=timezone.now())

    agent_client = APIClient()
    agent_client.force_authenticate(user=agent)
    assert len(agent_client.get("/api/attendance/").data["results"]) == 1

    other_client = APIClient()
    other = agent.__class__.objects.create_user(username="other-agent@test.local", password="x", is_field_agent=True)
    other_client.force_authenticate(user=other)
    assert len(other_client.get("/api/attendance/").data["results"]) == 0

    supervisor_client = APIClient()
    supervisor_client.force_authenticate(user=supervisor)
    assert len(supervisor_client.get("/api/attendance/").data["results"]) == 1


@pytest.mark.django_db
def test_attendance_push_is_idempotent(agent):
    import uuid

    client = APIClient()
    client.force_authenticate(user=agent)
    record_id = str(uuid.uuid4())
    payload = {
        "items": [
            {"entity_type": "attendance", "payload": {"id": record_id, "check_in_at": timezone.now().isoformat()}}
        ]
    }
    first = client.post("/api/sync/push/", payload, format="json")
    assert first.status_code == 200, first.data
    assert first.data["results"][0]["status"] == "applied"

    second = client.post("/api/sync/push/", payload, format="json")
    assert second.status_code == 200
    assert second.data["results"][0]["status"] == "applied"
    assert Attendance.objects.filter(id=record_id).count() == 1


@pytest.mark.django_db
def test_report_export_attendance(admin, agent):
    Attendance.objects.create(agent=agent, check_in_at=timezone.now())
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get("/api/reporting/export/attendance/?filetype=xlsx")
    assert response.status_code == 200
    assert response.content[:2] == b"PK"
