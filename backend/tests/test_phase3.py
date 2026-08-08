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


@pytest.mark.django_db
def test_compliance_due_alerts_flags_expiring_document():
    from apps.fleet.models import Vehicle, VehicleDocument
    from apps.fleet.services import STATUS_DUE_SOON, compliance_due_alerts

    vehicle = Vehicle.objects.create(reg_no="MH-01-TEST")
    VehicleDocument.objects.create(
        vehicle=vehicle, document_type=VehicleDocument.DOC_PUC,
        expiry_date=timezone.localdate() + timezone.timedelta(days=10),
    )
    VehicleDocument.objects.create(
        vehicle=vehicle, document_type=VehicleDocument.DOC_INSURANCE,
        expiry_date=timezone.localdate() + timezone.timedelta(days=200),
    )

    alerts = compliance_due_alerts()
    assert len(alerts) == 1
    assert alerts[0]["status"] == STATUS_DUE_SOON
    assert alerts[0]["document_type"] == VehicleDocument.DOC_PUC


@pytest.mark.django_db
def test_vehicle_document_api_requires_exactly_one_holder(admin, agent):
    from apps.fleet.models import Vehicle

    vehicle = Vehicle.objects.create(reg_no="MH-02-TEST")
    client = APIClient()
    client.force_authenticate(user=admin)

    both = client.post(
        "/api/fleet/documents/",
        {"vehicle": str(vehicle.id), "agent": str(agent.id), "document_type": "rc", "expiry_date": "2030-01-01"},
        format="json",
    )
    assert both.status_code == 400

    neither = client.post(
        "/api/fleet/documents/", {"document_type": "rc", "expiry_date": "2030-01-01"}, format="json"
    )
    assert neither.status_code == 400

    valid = client.post(
        "/api/fleet/documents/",
        {"vehicle": str(vehicle.id), "document_type": "rc", "expiry_date": "2030-01-01"},
        format="json",
    )
    assert valid.status_code == 201, valid.data


@pytest.mark.django_db
def test_geofence_alerts_detects_restricted_zone_entry(agent):
    from apps.fleet.models import Geofence, LocationPing, Trip

    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_IN_PROGRESS, start_time=timezone.now())
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"),
        recorded_at=timezone.now(),
    )
    Geofence.objects.create(
        name="Restricted Depot", zone_type=Geofence.ZONE_RESTRICTED,
        latitude=Decimal("19.076100"), longitude=Decimal("72.877800"), radius_meters=500,
    )

    from apps.fleet.services import geofence_alerts

    alerts = geofence_alerts()
    assert len(alerts) == 1
    assert alerts[0]["zone_name"] == "Restricted Depot"


@pytest.mark.django_db
def test_geofence_alerts_ignores_trip_far_from_zone(agent):
    from apps.fleet.models import Geofence, LocationPing, Trip

    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_IN_PROGRESS, start_time=timezone.now())
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("28.6139"), longitude=Decimal("77.2090"),
        recorded_at=timezone.now(),
    )
    Geofence.objects.create(
        name="Restricted Depot", zone_type=Geofence.ZONE_RESTRICTED,
        latitude=Decimal("19.076100"), longitude=Decimal("72.877800"), radius_meters=500,
    )

    from apps.fleet.services import geofence_alerts

    assert geofence_alerts() == []


@pytest.mark.django_db
def test_inventory_velocity_report_flags_stock_out(van_godown, item):
    from apps.inventory.models import StockLedgerEntry, VanStock
    from apps.reporting.report_builders import inventory_velocity_report

    VanStock.objects.filter(godown=van_godown, item=item).update(qty_on_hand=0)
    StockLedgerEntry.objects.create(
        godown=van_godown, item=item, txn_type=StockLedgerEntry.TXN_SALE, qty=Decimal("-10"), balance_after=0,
    )

    title, headers, rows = inventory_velocity_report()
    assert any(r[0] == item.sku and r[5] == "Stock-out" for r in rows)


@pytest.mark.django_db
def test_report_export_fleet_compliance_and_geofence_and_inventory(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    for key in ["fleet_compliance", "fleet_geofence", "inventory_velocity"]:
        response = client.get(f"/api/reporting/export/{key}/?filetype=xlsx")
        assert response.status_code == 200, (key, response.content[:200])
        assert response.content[:2] == b"PK"


def _bonus_item(van_godown):
    from apps.catalog.models import UOM, Item

    uom = UOM.objects.get_or_create(code="BONUS-PCS", defaults={"name": "Pieces"})[0]
    return Item.objects.create(sku="SKU-BONUS", name="Bonus Item", base_uom=uom, gst_rate=Decimal("18.00"))


@pytest.mark.django_db
def test_bxgy_multiples_for_boundary_cases(item, van_godown):
    from apps.catalog.models import SchemeBXGY

    bonus_item = _bonus_item(van_godown)
    scheme = SchemeBXGY.objects.create(
        name="Buy 10 get 1", trigger_item=item, trigger_qty=Decimal("10"),
        bonus_item=bonus_item, bonus_qty=Decimal("1"),
        valid_from=date(2020, 1, 1), valid_to=date(2030, 1, 1),
    )
    assert scheme.multiples_for(Decimal("9")) == 0
    assert scheme.multiples_for(Decimal("10")) == 1
    assert scheme.multiples_for(Decimal("25")) == 2  # partial second multiple doesn't count
    assert scheme.multiples_for(Decimal("30")) == 3


@pytest.mark.django_db
def test_bxgy_multiples_respects_max_multiples_cap(item, van_godown):
    from apps.catalog.models import SchemeBXGY

    bonus_item = _bonus_item(van_godown)
    scheme = SchemeBXGY.objects.create(
        name="Buy 5 get 1, capped", trigger_item=item, trigger_qty=Decimal("5"),
        bonus_item=bonus_item, bonus_qty=Decimal("1"), max_multiples=2,
        valid_from=date(2020, 1, 1), valid_to=date(2030, 1, 1),
    )
    assert scheme.multiples_for(Decimal("50")) == 2


@pytest.mark.django_db
def test_bxgy_injects_free_bonus_line_on_invoice_finalize(company, agent, van_godown, item, customer):
    from apps.catalog.models import SchemeBXGY
    from apps.sales.models import Invoice, InvoiceLine
    from apps.sales.services import finalize_invoice

    bonus_item = _bonus_item(van_godown)
    SchemeBXGY.objects.create(
        name="Buy 10 get 1 free", trigger_item=item, trigger_qty=Decimal("10"),
        bonus_item=bonus_item, bonus_qty=Decimal("1"),
        valid_from=date(2020, 1, 1), valid_to=date(2030, 1, 1),
    )

    _, gst_registration = company
    invoice = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=invoice, item=item, qty=Decimal("20"), rate=Decimal("10.00"))
    finalize_invoice(invoice)

    invoice.refresh_from_db()
    bonus_lines = list(invoice.lines.filter(is_bonus=True))
    assert len(bonus_lines) == 1
    bonus_line = bonus_lines[0]
    assert bonus_line.item_id == bonus_item.id
    assert bonus_line.qty == Decimal("2")  # 20 // 10 = 2 multiples
    # Fully waived regardless of rate: taxable/tax/line_total all zero.
    assert bonus_line.taxable_amount == Decimal("0.00")
    assert bonus_line.cgst_amount == Decimal("0.00")
    assert bonus_line.line_total == Decimal("0.00")
    # The trigger line's own price is untouched by the bonus scheme.
    trigger_line = invoice.lines.get(is_bonus=False)
    assert trigger_line.discount_amount == Decimal("0")


@pytest.mark.django_db
def test_bxgy_bonus_line_is_regenerated_not_duplicated_on_recompute(company, agent, van_godown, item, customer):
    from apps.catalog.models import SchemeBXGY
    from apps.sales.models import Invoice, InvoiceLine
    from apps.sales.services import finalize_invoice, recompute_invoice

    bonus_item = _bonus_item(van_godown)
    SchemeBXGY.objects.create(
        name="Buy 10 get 1 free", trigger_item=item, trigger_qty=Decimal("10"),
        bonus_item=bonus_item, bonus_qty=Decimal("1"),
        valid_from=date(2020, 1, 1), valid_to=date(2030, 1, 1),
    )

    _, gst_registration = company
    invoice = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=invoice, item=item, qty=Decimal("10"), rate=Decimal("10.00"))
    finalize_invoice(invoice)
    assert invoice.lines.filter(is_bonus=True).count() == 1
    assert invoice.lines.get(is_bonus=True).qty == Decimal("1")

    # Calling recompute again (e.g. a second sync-time pass) must replace,
    # not duplicate, the bonus line — and reflect an updated trigger qty.
    recompute_invoice(invoice)
    assert invoice.lines.filter(is_bonus=True).count() == 1

    invoice.lines.filter(is_bonus=False).update(qty=Decimal("20"))
    recompute_invoice(invoice)
    assert invoice.lines.filter(is_bonus=True).count() == 1
    assert invoice.lines.get(is_bonus=True).qty == Decimal("2")


@pytest.mark.django_db
def test_bxgy_scheme_api_crud(admin, item, van_godown):
    bonus_item = _bonus_item(van_godown)
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post(
        "/api/catalog/schemes-bxgy/",
        {
            "name": "Buy 10 get 1", "trigger_item": item.id, "trigger_qty": "10",
            "bonus_item": bonus_item.id, "bonus_qty": "1",
            "valid_from": "2020-01-01", "valid_to": "2030-01-01",
        },
        format="json",
    )
    assert response.status_code == 201, response.data

    list_response = client.get("/api/catalog/schemes-bxgy/")
    assert list_response.status_code == 200
    assert list_response.data["count"] == 1


@pytest.mark.django_db
def test_push_notification_falls_back_to_console_without_fcm_key(agent, settings):
    from apps.notifications.models import NotificationLog
    from apps.notifications.services import send_push_notification

    settings.FCM_SERVER_KEY = ""
    log = send_push_notification(agent, "Test title", "Test body", data={"k": "v"})

    assert log.channel == NotificationLog.CHANNEL_CONSOLE
    assert log.device_count == 0
    assert NotificationLog.objects.filter(user=agent, title="Test title").exists()


@pytest.mark.django_db
def test_device_token_registration_is_idempotent_per_token(agent):
    from apps.notifications.models import DeviceToken

    client = APIClient()
    client.force_authenticate(user=agent)

    payload = {"token": "device-abc-123", "platform": DeviceToken.PLATFORM_ANDROID}
    response1 = client.post("/api/notifications/device-tokens/", payload, format="json")
    assert response1.status_code == 201, response1.data

    # Re-registering the same token (app reinstall / refresh) must not 409.
    response2 = client.post("/api/notifications/device-tokens/", payload, format="json")
    assert response2.status_code == 201, response2.data
    assert DeviceToken.objects.filter(token="device-abc-123").count() == 1


@pytest.mark.django_db
def test_expense_approve_sends_push_notification_to_agent(agent, supervisor):
    from apps.expenses.models import Expense
    from apps.notifications.models import NotificationLog

    expense = Expense.objects.create(
        agent=agent, category=Expense.CATEGORY_MISC, amount=Decimal("300"), expense_date=date.today(),
    )
    client = APIClient()
    client.force_authenticate(user=supervisor)
    response = client.post(f"/api/expenses/{expense.id}/approve/")
    assert response.status_code == 200

    log = NotificationLog.objects.filter(user=agent, title="Expense approved").first()
    assert log is not None
    assert str(expense.id) in log.data.get("expense_id", "")


@pytest.mark.django_db
def test_notification_log_scoped_to_own_user_unless_privileged(agent, supervisor):
    from apps.notifications.services import send_push_notification

    send_push_notification(agent, "For agent", "body")
    send_push_notification(supervisor, "For supervisor", "body")

    agent_client = APIClient()
    agent_client.force_authenticate(user=agent)
    response = agent_client.get("/api/notifications/logs/")
    assert response.status_code == 200
    titles = [row["title"] for row in response.data["results"]]
    assert "For agent" in titles
    assert "For supervisor" not in titles
