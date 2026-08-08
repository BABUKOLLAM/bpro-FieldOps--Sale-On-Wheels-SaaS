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


def _make_invoice(company, agent, van_godown, item, customer):
    from apps.sales.models import Invoice, InvoiceLine
    from apps.sales.services import finalize_invoice

    _, gst_registration = company
    invoice = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=invoice, item=item, qty=Decimal("1"), rate=Decimal("10.00"))
    finalize_invoice(invoice)
    return invoice


def _extract_otp_code(phone):
    import re

    from apps.notifications.models import SmsLog

    log = SmsLog.objects.filter(phone=phone).order_by("-created_at").first()
    match = re.search(r"is (\d{6})", log.message)
    return match.group(1)


@pytest.mark.django_db
def test_send_delivery_otp_requires_customer_phone(company, agent, van_godown, item, customer):
    from apps.core.exceptions import DomainError
    from apps.sales.services import send_delivery_otp

    invoice = _make_invoice(company, agent, van_godown, item, customer)
    with pytest.raises(DomainError):
        send_delivery_otp(invoice)


@pytest.mark.django_db
def test_send_and_verify_delivery_otp_happy_path(company, agent, van_godown, item, customer):
    from apps.sales.models import Invoice
    from apps.sales.services import send_delivery_otp, verify_delivery_otp

    customer.phone = "9876543210"
    customer.save(update_fields=["phone"])
    invoice = _make_invoice(company, agent, van_godown, item, customer)

    send_delivery_otp(invoice)
    code = _extract_otp_code(customer.phone)

    verify_delivery_otp(invoice, code)
    invoice.refresh_from_db()
    assert invoice.delivery_confirmed_via == Invoice.DELIVERY_VIA_OTP
    assert invoice.delivery_confirmed_at is not None


@pytest.mark.django_db
def test_verify_delivery_otp_wrong_code_locks_after_max_attempts(company, agent, van_godown, item, customer):
    from apps.core.exceptions import DomainError
    from apps.sales.models import InvoiceDeliveryOTP
    from apps.sales.services import send_delivery_otp, verify_delivery_otp

    customer.phone = "9876543210"
    customer.save(update_fields=["phone"])
    invoice = _make_invoice(company, agent, van_godown, item, customer)
    send_delivery_otp(invoice)

    for _ in range(InvoiceDeliveryOTP.MAX_ATTEMPTS):
        with pytest.raises(DomainError):
            verify_delivery_otp(invoice, "000000")

    with pytest.raises(DomainError) as exc_info:
        verify_delivery_otp(invoice, "000000")
    assert exc_info.value.code == "otp_locked"


@pytest.mark.django_db
def test_invoice_otp_delivery_flow_via_api(company, agent, van_godown, item, customer):
    from apps.sales.models import Invoice

    customer.phone = "9876543210"
    customer.save(update_fields=["phone"])
    invoice = _make_invoice(company, agent, van_godown, item, customer)

    client = APIClient()
    client.force_authenticate(user=agent)

    response = client.post(f"/api/sales/invoices/{invoice.id}/send-delivery-otp/")
    assert response.status_code == 200, response.data

    code = _extract_otp_code(customer.phone)
    response = client.post(
        f"/api/sales/invoices/{invoice.id}/verify-delivery-otp/", {"code": code}, format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["delivery_confirmed_via"] == Invoice.DELIVERY_VIA_OTP


@pytest.mark.django_db
def test_trip_idle_minutes_from_stationary_pings(agent):
    from apps.fleet.models import LocationPing, Trip
    from apps.fleet.services import trip_idle_minutes

    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_COMPLETED, start_time=timezone.now())
    base = timezone.now()
    # Three pings ~100m apart in time, all within the idle radius of each
    # other -> the whole 20-minute span between them counts as idle.
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"), recorded_at=base,
    )
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.076010"), longitude=Decimal("72.877710"),
        recorded_at=base + timezone.timedelta(minutes=10),
    )
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.076020"), longitude=Decimal("72.877720"),
        recorded_at=base + timezone.timedelta(minutes=20),
    )
    assert trip_idle_minutes(trip) == 20


@pytest.mark.django_db
def test_trip_idle_minutes_zero_when_moving(agent):
    from apps.fleet.models import LocationPing, Trip
    from apps.fleet.services import trip_idle_minutes

    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_COMPLETED, start_time=timezone.now())
    base = timezone.now()
    # Consecutive pings ~11km apart -- clearly moving, not idle.
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"), recorded_at=base,
    )
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.176000"), longitude=Decimal("72.977700"),
        recorded_at=base + timezone.timedelta(minutes=10),
    )
    assert trip_idle_minutes(trip) == 0


@pytest.mark.django_db
def test_route_deviation_points_flags_ping_far_from_every_stop(agent, customer):
    from apps.customers.models import Beat, BeatCustomer, CustomerAddress
    from apps.fleet.models import LocationPing, Trip
    from apps.fleet.services import route_deviation_points

    CustomerAddress.objects.create(
        customer=customer, line1="Test", city="Mumbai",
        latitude=Decimal("19.076000"), longitude=Decimal("72.877700"),
    )
    beat = Beat.objects.create(name="Test Beat", assigned_agent=agent)
    BeatCustomer.objects.create(beat=beat, customer=customer, visit_sequence=1)
    trip = Trip.objects.create(agent=agent, beat=beat, status=Trip.STATUS_COMPLETED, start_time=timezone.now())

    # On-route: right at the stop.
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"),
        recorded_at=timezone.now(),
    )
    # Off-route: ~11km away, well past the 2km threshold.
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.176000"), longitude=Decimal("72.977700"),
        recorded_at=timezone.now() + timezone.timedelta(minutes=5),
    )

    deviations = route_deviation_points(trip)
    assert len(deviations) == 1
    assert deviations[0]["distance_km"] > 2.0


@pytest.mark.django_db
def test_route_deviation_points_empty_without_beat(agent):
    from apps.fleet.models import LocationPing, Trip
    from apps.fleet.services import route_deviation_points

    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_COMPLETED, start_time=timezone.now())
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"),
        recorded_at=timezone.now(),
    )
    assert route_deviation_points(trip) == []


@pytest.mark.django_db
def test_trip_route_analytics_excludes_unremarkable_trips(agent, customer):
    from apps.fleet.models import LocationPing, Trip
    from apps.fleet.services import trip_route_analytics

    # A trip with movement and no beat at all -- nothing notable, must
    # not clutter the results.
    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_COMPLETED, start_time=timezone.now())
    base = timezone.now()
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"), recorded_at=base,
    )
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.176000"), longitude=Decimal("72.977700"),
        recorded_at=base + timezone.timedelta(minutes=10),
    )
    assert trip_route_analytics() == []


@pytest.mark.django_db
def test_fleet_dashboard_includes_route_analytics(supervisor):
    client = APIClient()
    client.force_authenticate(user=supervisor)
    response = client.get("/api/fleet/dashboard/")
    assert response.status_code == 200
    assert "route_analytics" in response.data


@pytest.mark.django_db
def test_report_export_fleet_route_analytics(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get("/api/reporting/export/fleet_route_analytics/?filetype=xlsx")
    assert response.status_code == 200, response.content[:200]
    assert response.content[:2] == b"PK"


@pytest.mark.django_db
def test_trip_speeding_events_detects_fast_segment(agent):
    from apps.fleet.models import LocationPing, Trip
    from apps.fleet.services import trip_speeding_events

    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_COMPLETED, start_time=timezone.now())
    base = timezone.now()
    # ~11km apart in 2 minutes -> ~330 km/h average, well over the limit.
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"), recorded_at=base,
    )
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.176000"), longitude=Decimal("72.977700"),
        recorded_at=base + timezone.timedelta(minutes=2),
    )
    events = trip_speeding_events(trip)
    assert len(events) == 1
    assert events[0]["speed_kmph"] > 80


@pytest.mark.django_db
def test_trip_speeding_events_empty_within_limit(agent):
    from apps.fleet.models import LocationPing, Trip
    from apps.fleet.services import trip_speeding_events

    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_COMPLETED, start_time=timezone.now())
    base = timezone.now()
    # ~1km apart in 2 minutes -> 30 km/h, well within the limit.
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"), recorded_at=base,
    )
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.085000"), longitude=Decimal("72.877700"),
        recorded_at=base + timezone.timedelta(minutes=2),
    )
    assert trip_speeding_events(trip) == []


@pytest.mark.django_db
def test_trip_safety_score_deducts_for_speeding_and_idling(agent):
    from apps.fleet.models import LocationPing, Trip
    from apps.fleet.services import trip_safety_score

    base = timezone.now()
    trip = Trip.objects.create(
        agent=agent, status=Trip.STATUS_COMPLETED, start_time=base, end_time=base + timezone.timedelta(minutes=60),
    )
    # A speeding segment...
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"), recorded_at=base,
    )
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.176000"), longitude=Decimal("72.977700"),
        recorded_at=base + timezone.timedelta(minutes=2),
    )
    # ...then 30 minutes idle (stationary) out of the 60-minute trip.
    LocationPing.objects.create(
        agent=agent, trip=trip, latitude=Decimal("19.176010"), longitude=Decimal("72.977710"),
        recorded_at=base + timezone.timedelta(minutes=32),
    )

    result = trip_safety_score(trip)
    assert result["speeding_event_count"] == 1
    assert result["idle_minutes"] == 30
    # 100 - 5 (one speeding event) - 5*3 (30/60=50% idle -> 5 buckets of 10%) = 70
    assert result["score"] == 70


@pytest.mark.django_db
def test_trip_safety_score_none_without_end_time(agent):
    from apps.fleet.models import Trip
    from apps.fleet.services import trip_safety_score

    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_IN_PROGRESS, start_time=timezone.now())
    assert trip_safety_score(trip) is None


@pytest.mark.django_db
def test_driver_safety_scores_ranks_worst_first(agent, supervisor):
    from apps.fleet.models import LocationPing, Trip
    from apps.fleet.services import driver_safety_scores

    base = timezone.now()
    # agent: one clean trip -> score 100.
    clean_trip = Trip.objects.create(
        agent=agent, status=Trip.STATUS_COMPLETED, start_time=base, end_time=base + timezone.timedelta(minutes=30),
    )
    LocationPing.objects.create(
        agent=agent, trip=clean_trip, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"), recorded_at=base,
    )
    LocationPing.objects.create(
        agent=agent, trip=clean_trip, latitude=Decimal("19.085000"), longitude=Decimal("72.877700"),
        recorded_at=base + timezone.timedelta(minutes=15),
    )

    # supervisor (also a valid trip.agent): one speeding trip -> lower score.
    speeding_trip = Trip.objects.create(
        agent=supervisor, status=Trip.STATUS_COMPLETED, start_time=base, end_time=base + timezone.timedelta(minutes=30),
    )
    LocationPing.objects.create(
        agent=supervisor, trip=speeding_trip, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"),
        recorded_at=base,
    )
    LocationPing.objects.create(
        agent=supervisor, trip=speeding_trip, latitude=Decimal("19.176000"), longitude=Decimal("72.977700"),
        recorded_at=base + timezone.timedelta(minutes=2),
    )

    scores = driver_safety_scores()
    assert scores[0]["agent_id"] == supervisor.id
    assert scores[0]["avg_score"] < scores[1]["avg_score"]
    assert scores[1]["agent_id"] == agent.id
    assert scores[1]["avg_score"] == 100


@pytest.mark.django_db
def test_fleet_dashboard_includes_driver_safety_scores(supervisor):
    client = APIClient()
    client.force_authenticate(user=supervisor)
    response = client.get("/api/fleet/dashboard/")
    assert response.status_code == 200
    assert "driver_safety_scores" in response.data


@pytest.mark.django_db
def test_report_export_driver_safety_scores(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get("/api/reporting/export/driver_safety_scores/?filetype=xlsx")
    assert response.status_code == 200, response.content[:200]
    assert response.content[:2] == b"PK"
