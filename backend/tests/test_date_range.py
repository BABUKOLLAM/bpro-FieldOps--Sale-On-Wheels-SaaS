"""From–To date filtering (apps/core/date_range.py) on every list API of
dated records and on the report exports: inclusive bounds, strict
YYYY-MM-DD validation, max span, tenant-local day boundaries for
DateTimeFields, unchanged role scoping, pagination, and per-tenant
database isolation. All data here is synthetic."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.contrib.contenttypes.models import ContentType
from openpyxl import load_workbook
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.attendance.models import Attendance
from apps.core.date_range import DateRange, apply_date_range, parse_date_range
from apps.customers.models import Customer
from apps.expenses.models import Expense
from apps.governance.models import ChangeRequest
from apps.integrations.models import SyncLogEntry
from apps.payments.models import PaymentOrder
from apps.sales.models import CreditNote, Invoice, Receipt, SalesOrder
from apps.tenancy.models import Tenant
from apps.tenancy.routing import deactivate_tenant, set_current_tenant_alias

IST = ZoneInfo("Asia/Kolkata")
UTC = ZoneInfo("UTC")


@pytest.fixture(autouse=True)
def _reset_tenant_context():
    deactivate_tenant()
    yield
    deactivate_tenant()


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(username="root@test.local", password="testpass123")


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def ids(response):
    assert response.status_code == 200, response.content
    return {row["id"] for row in response.json()["results"]}


def ist(y, m, d, hh=12, mm=0):
    return datetime(y, m, d, hh, mm, tzinfo=IST)


# ---------------------------------------------------------------- parsing


@pytest.mark.parametrize("bad", ["2026-1-05", "05/11/2026", "2026/11/05", "20261105", "2026-11-05T00:00", "x"])
def test_parse_rejects_non_iso_formats(bad):
    from rest_framework.exceptions import ValidationError

    with pytest.raises(ValidationError):
        parse_date_range({"date_from": bad})


def test_parse_rejects_impossible_calendar_date():
    from rest_framework.exceptions import ValidationError

    with pytest.raises(ValidationError):
        parse_date_range({"date_to": "2026-02-30"})


def test_parse_rejects_reversed_range():
    from rest_framework.exceptions import ValidationError

    with pytest.raises(ValidationError):
        parse_date_range({"date_from": "2026-11-10", "date_to": "2026-11-09"})


def test_parse_span_limit_is_inclusive_366_days(settings):
    settings.DATE_RANGE_MAX_SPAN_DAYS = 366
    from rest_framework.exceptions import ValidationError

    ok = parse_date_range({"date_from": "2026-04-01", "date_to": "2027-04-01"})  # 366 days inclusive
    assert ok == DateRange(date(2026, 4, 1), date(2027, 4, 1))
    with pytest.raises(ValidationError):
        parse_date_range({"date_from": "2026-04-01", "date_to": "2027-04-02"})


def test_parse_blank_means_no_filter_and_single_day_is_fine():
    assert not parse_date_range({"date_from": "", "date_to": ""}).is_set
    one = parse_date_range({"date_from": "2026-11-09", "date_to": "2026-11-09"})
    assert one.start == one.end == date(2026, 11, 9)


def test_parse_alternate_keys_for_reports():
    r = parse_date_range(
        {"period_start": "2026-11-01", "period_end": "2026-11-09"},
        from_keys=("period_start", "date_from"), to_keys=("period_end", "date_to"),
    )
    assert r == DateRange(date(2026, 11, 1), date(2026, 11, 9))


# ------------------------------------------------- timezone day boundaries


@pytest.mark.django_db
def test_datetime_bounds_use_tenant_local_day(agent, customer):
    """IST is UTC+5:30, so the IST day 2026-11-09 is
    [2026-11-08 18:30 UTC, 2026-11-09 18:30 UTC)."""
    def receipt(at):
        return Receipt.objects.create(customer=customer, agent=agent, mode="cash", amount=Decimal("1"), received_at=at)

    before_start = receipt(datetime(2026, 11, 8, 18, 29, 59, tzinfo=UTC))  # 2026-11-08 23:59:59 IST
    at_start = receipt(datetime(2026, 11, 8, 18, 30, tzinfo=UTC))  # 2026-11-09 00:00 IST
    late_evening = receipt(ist(2026, 11, 9, 23, 59))  # still the 9th in IST, but the 9th in UTC too
    next_day = receipt(ist(2026, 11, 10, 0, 0))  # 2026-11-09 18:30 UTC — UTC says the 9th

    got = set(
        apply_date_range(
            Receipt.objects.all(), "received_at", DateRange(date(2026, 11, 9), date(2026, 11, 9)), tz=IST,
        ).values_list("id", flat=True)
    )
    assert got == {at_start.id, late_evening.id}
    assert before_start.id not in got and next_day.id not in got


# ------------------------------------------------------ per-endpoint ranges


@pytest.fixture
def invoice_factory(company, agent, customer, van_godown):
    _, gst = company

    def make(on, owner=None, **extra):
        return Invoice.objects.create(
            customer=customer, agent=owner or agent, godown=van_godown, gst_registration=gst,
            place_of_supply_state="MH", invoice_date=on, grand_total=Decimal("100"), **extra,
        )

    return make


@pytest.mark.django_db
def test_orders_filter_on_order_date_inclusive(superuser, agent, customer):
    mk = lambda d: SalesOrder.objects.create(customer=customer, agent=agent, order_date=d)  # noqa: E731
    first, last, outside_a, outside_b = mk(date(2026, 11, 1)), mk(date(2026, 11, 9)), mk(date(2026, 10, 31)), mk(date(2026, 11, 10))
    c = client_for(superuser)
    got = ids(c.get("/api/sales/orders/", {"date_from": "2026-11-01", "date_to": "2026-11-09"}))
    assert got == {str(first.id), str(last.id)}
    assert str(outside_a.id) not in got and str(outside_b.id) not in got
    # No params -> unfiltered (existing callers unaffected).
    assert len(ids(c.get("/api/sales/orders/"))) == 4


@pytest.mark.django_db
def test_invoices_filter_on_invoice_date_and_combine_with_other_filters(superuser, invoice_factory):
    keep = invoice_factory(date(2026, 11, 5), credit_check_status=Invoice.CREDIT_PENDING_REVIEW)
    invoice_factory(date(2026, 11, 5))  # in range, wrong status
    invoice_factory(date(2026, 10, 5), credit_check_status=Invoice.CREDIT_PENDING_REVIEW)  # wrong date
    got = ids(client_for(superuser).get(
        "/api/sales/invoices/",
        {"credit_check_status": "pending_review", "date_from": "2026-11-01", "date_to": "2026-11-09"},
    ))
    assert got == {str(keep.id)}


@pytest.mark.django_db
def test_receipts_filter_on_received_at_in_ist(superuser, agent, customer):
    mk = lambda at: Receipt.objects.create(  # noqa: E731
        customer=customer, agent=agent, mode="cash", amount=Decimal("5"), received_at=at,
    )
    inside = mk(ist(2026, 11, 9, 23, 59))
    edge_out = mk(ist(2026, 11, 10, 0, 0))
    got = ids(client_for(superuser).get("/api/sales/receipts/", {"date_from": "2026-11-09", "date_to": "2026-11-09"}))
    assert got == {str(inside.id)}
    assert str(edge_out.id) not in got


@pytest.mark.django_db
def test_credit_notes_filter_on_note_date(superuser, agent, customer, invoice_factory):
    inv = invoice_factory(date(2026, 11, 1))
    mk = lambda d: CreditNote.objects.create(  # noqa: E731
        original_invoice=inv, customer=customer, agent=agent, reason_code="damaged", note_date=d,
    )
    keep, drop = mk(date(2026, 11, 3)), mk(date(2026, 11, 4))
    got = ids(client_for(superuser).get("/api/sales/credit-notes/", {"date_to": "2026-11-03"}))
    assert got == {str(keep.id)}
    assert str(drop.id) not in got


@pytest.mark.django_db
def test_payment_orders_filter_on_created_at(superuser, invoice_factory):
    inv = invoice_factory(date(2026, 11, 1))
    keep = PaymentOrder.objects.create(invoice=inv, gateway_type="mock", amount=Decimal("10"))
    drop = PaymentOrder.objects.create(invoice=inv, gateway_type="mock", amount=Decimal("10"))
    PaymentOrder.objects.filter(pk=keep.pk).update(created_at=ist(2026, 11, 2, 0, 0))
    PaymentOrder.objects.filter(pk=drop.pk).update(created_at=ist(2026, 11, 1, 23, 59))
    got = ids(client_for(superuser).get("/api/payments/orders/", {"date_from": "2026-11-02"}))
    assert got == {str(keep.id)}


@pytest.mark.django_db
def test_expenses_filter_on_expense_date(superuser, agent):
    mk = lambda d: Expense.objects.create(agent=agent, category="fuel", amount=Decimal("1"), expense_date=d)  # noqa: E731
    keep, drop = mk(date(2026, 11, 9)), mk(date(2026, 11, 8))
    got = ids(client_for(superuser).get(
        "/api/expenses/", {"status": "submitted", "date_from": "2026-11-09", "date_to": "2026-11-09"},
    ))
    assert got == {str(keep.id)}
    assert str(drop.id) not in got


@pytest.mark.django_db
def test_attendance_filter_on_check_in_at(superuser, agent):
    keep = Attendance.objects.create(agent=agent, check_in_at=ist(2026, 11, 9, 0, 5))
    Attendance.objects.create(agent=agent, check_in_at=ist(2026, 11, 8, 23, 55), check_out_at=ist(2026, 11, 9, 1))
    got = ids(client_for(superuser).get("/api/attendance/", {"date_from": "2026-11-09", "date_to": "2026-11-09"}))
    assert got == {str(keep.id)}


@pytest.mark.django_db
def test_sync_log_filter_on_created_at(admin):
    import uuid

    keep = SyncLogEntry.objects.create(entity_type="invoice", local_object_id=uuid.uuid4())
    drop = SyncLogEntry.objects.create(entity_type="invoice", local_object_id=uuid.uuid4())
    SyncLogEntry.objects.filter(pk=keep.pk).update(created_at=ist(2026, 11, 9, 10))
    SyncLogEntry.objects.filter(pk=drop.pk).update(created_at=ist(2026, 10, 9, 10))
    got = ids(client_for(admin).get("/api/integrations/sync-log/", {"date_from": "2026-11-01", "date_to": "2026-11-30"}))
    assert got == {str(keep.id)}


@pytest.mark.django_db
def test_change_requests_filter_on_requested_at(admin):
    role = Role.objects.first()
    mk = lambda: ChangeRequest.objects.create(  # noqa: E731
        content_type=ContentType.objects.get_for_model(Role), object_id=str(role.pk),
        proposed_changes={"description": "x"}, requested_by=admin,
    )
    keep, drop = mk(), mk()
    ChangeRequest.objects.filter(pk=keep.pk).update(requested_at=ist(2026, 11, 9, 9))
    ChangeRequest.objects.filter(pk=drop.pk).update(requested_at=ist(2026, 11, 7, 9))
    got = ids(client_for(admin).get(
        "/api/governance/change-requests/", {"status": "pending", "date_from": "2026-11-08", "date_to": "2026-11-09"},
    ))
    assert got == {str(keep.id)}


@pytest.mark.django_db
@pytest.mark.parametrize("path", [
    "/api/sales/orders/", "/api/sales/invoices/", "/api/sales/receipts/", "/api/sales/credit-notes/",
    "/api/payments/orders/", "/api/expenses/", "/api/attendance/",
])
@pytest.mark.parametrize("params", [
    {"date_from": "09-11-2026"},
    {"date_to": "2026-13-01"},
    {"date_from": "2026-11-10", "date_to": "2026-11-09"},
    {"date_from": "2024-01-01", "date_to": "2026-11-09"},
])
def test_every_list_endpoint_rejects_bad_ranges_with_400(superuser, path, params):
    response = client_for(superuser).get(path, params)
    assert response.status_code == 400, (path, params, response.content)


# ------------------------------------------------ role scoping is unchanged


@pytest.mark.django_db
def test_agent_still_sees_only_own_records_within_range(agent, customer):
    other = User.objects.create_user(username="other-agent@test.local", password="testpass123", is_field_agent=True)
    mine = SalesOrder.objects.create(customer=customer, agent=agent, order_date=date(2026, 11, 5))
    SalesOrder.objects.create(customer=customer, agent=other, order_date=date(2026, 11, 5))
    mine_r = Receipt.objects.create(customer=customer, agent=agent, mode="cash", amount=1, received_at=ist(2026, 11, 5))
    Receipt.objects.create(customer=customer, agent=other, mode="cash", amount=1, received_at=ist(2026, 11, 5))
    c = client_for(agent)
    params = {"date_from": "2026-11-01", "date_to": "2026-11-09"}
    assert ids(c.get("/api/sales/orders/", params)) == {str(mine.id)}
    assert ids(c.get("/api/sales/receipts/", params)) == {str(mine_r.id)}


@pytest.mark.django_db
def test_agent_cannot_widen_scope_via_agent_filter_plus_range(agent, customer):
    other = User.objects.create_user(username="other2@test.local", password="testpass123", is_field_agent=True)
    SalesOrder.objects.create(customer=customer, agent=other, order_date=date(2026, 11, 5))
    got = ids(client_for(agent).get(
        "/api/sales/orders/", {"agent": str(other.id), "date_from": "2026-11-01", "date_to": "2026-11-09"},
    ))
    assert got == set()


@pytest.mark.django_db
def test_sync_log_permission_still_enforced_with_range(agent):
    response = client_for(agent).get("/api/integrations/sync-log/", {"date_from": "2026-11-01"})
    assert response.status_code == 403


# ------------------------------------------------------------- pagination


@pytest.mark.django_db
def test_pagination_counts_the_filtered_set(superuser, agent, customer):
    for day in range(1, 8):
        SalesOrder.objects.create(customer=customer, agent=agent, order_date=date(2026, 11, day))
    SalesOrder.objects.create(customer=customer, agent=agent, order_date=date(2026, 10, 1))
    c = client_for(superuser)
    page1 = c.get("/api/sales/orders/", {"date_from": "2026-11-01", "date_to": "2026-11-30", "page_size": 5}).json()
    assert page1["count"] == 7 and len(page1["results"]) == 5
    assert "date_from=2026-11-01" in page1["next"]
    page2 = c.get(page1["next"]).json()
    assert len(page2["results"]) == 2 and page2["next"] is None


# --------------------------------------------------------- tenant isolation


@pytest.mark.django_db(databases=["default", "tenant_test_a", "tenant_test_b"])
def test_range_filter_never_crosses_tenant_databases():
    """Same dates in two tenant databases; a request resolved to tenant A
    (X-Tenant-Slug) with a range only ever returns tenant A's rows."""
    Tenant.objects.create(slug="test_a", name="Tenant A", db_name="x", db_host="x", db_user="x")
    Tenant.objects.create(slug="test_b", name="Tenant B", db_name="x", db_host="x", db_user="x")

    made = {}
    for alias in ("tenant_test_a", "tenant_test_b"):
        set_current_tenant_alias(alias)
        user = User.objects.create_superuser(username=f"root-{alias}@test.local", password="testpass123")
        cust = Customer.objects.create(code=f"C-{alias}", name=f"Customer {alias}", credit_limit=0, credit_days=0)
        order = SalesOrder.objects.create(customer=cust, agent=user, order_date=date(2026, 11, 5))
        made[alias] = (user, order)
    deactivate_tenant()

    user_a, order_a = made["tenant_test_a"]
    client = APIClient()
    client.force_authenticate(user_a)
    response = client.get(
        "/api/sales/orders/", {"date_from": "2026-11-01", "date_to": "2026-11-09"}, HTTP_X_TENANT_SLUG="test_a",
    )
    assert ids(response) == {str(order_a.id)}
    # And nothing landed in (or leaked from) the default database.
    assert not SalesOrder.objects.using("default").exists()


# ------------------------------------------------------------ report exports


def _xlsx_rows(response):
    from io import BytesIO

    assert response.status_code == 200, response.content
    sheet = load_workbook(BytesIO(b"".join(response.streaming_content) if response.streaming else response.content)).active
    return [list(r) for r in sheet.iter_rows(values_only=True)]


@pytest.mark.django_db
def test_report_list_flags_period_support(admin):
    data = client_for(admin).get("/api/reporting/reports/").json()
    flags = {r["key"]: r["supports_period"] for r in data}
    assert flags["sales"] and flags["collections"] and flags["returns"] and flags["expenses"]
    assert not flags["outstanding"] and not flags["fleet_utilization"]


@pytest.mark.django_db
def test_collections_export_follows_period_in_ist(admin, agent, customer):
    Receipt.objects.create(customer=customer, agent=agent, mode="cash", amount=Decimal("11"), received_at=ist(2026, 11, 9, 23, 59), receipt_no="R-IN")
    Receipt.objects.create(customer=customer, agent=agent, mode="cash", amount=Decimal("22"), received_at=ist(2026, 11, 10, 0, 0), receipt_no="R-OUT")
    response = client_for(admin).get(
        "/api/reporting/export/collections/", {"filetype": "xlsx", "period_start": "2026-11-09", "period_end": "2026-11-09"},
    )
    assert "collections-2026-11-09-2026-11-09" in response["Content-Disposition"]
    flat = str(_xlsx_rows(response))
    assert "R-IN" in flat and "R-OUT" not in flat

    from apps.reporting.report_builders import collections_report

    title, _, _ = collections_report(DateRange(date(2026, 11, 9), date(2026, 11, 9)))
    assert title == "Collections Report — 2026-11-09 to 2026-11-09"  # shown in the PDF heading


@pytest.mark.django_db
def test_sales_export_period_and_unfiltered_default(admin, invoice_factory):
    invoice_factory(date(2026, 11, 2), invoice_no="INV-IN")
    invoice_factory(date(2026, 10, 2), invoice_no="INV-OUT")
    c = client_for(admin)
    ranged = str(_xlsx_rows(c.get("/api/reporting/export/sales/", {"period_start": "2026-11-01", "period_end": "2026-11-30"})))
    assert "INV-IN" in ranged and "INV-OUT" not in ranged
    everything = str(_xlsx_rows(c.get("/api/reporting/export/sales/")))
    assert "INV-IN" in everything and "INV-OUT" in everything


@pytest.mark.django_db
def test_export_rejects_bad_period(admin):
    c = client_for(admin)
    assert c.get("/api/reporting/export/sales/", {"period_start": "1/11/2026"}).status_code == 400
    assert c.get("/api/reporting/export/sales/", {"period_start": "2026-11-09", "period_end": "2026-11-01"}).status_code == 400


@pytest.mark.django_db
def test_snapshot_report_ignores_period(admin, customer):
    response = client_for(admin).get(
        "/api/reporting/export/outstanding/", {"period_start": "2026-11-01", "period_end": "2026-11-09"},
    )
    assert "CUST-TEST" in str(_xlsx_rows(response))


@pytest.mark.django_db
def test_email_export_accepts_period(admin, agent, customer):
    from django.core import mail

    Receipt.objects.create(customer=customer, agent=agent, mode="cash", amount=Decimal("1"), received_at=ist(2026, 11, 9))
    response = client_for(admin).post(
        "/api/reporting/export/collections/email/",
        {"to": "reports@example.com", "filetype": "xlsx", "period_start": "2026-11-09", "period_end": "2026-11-09"},
        format="json",
    )
    assert response.status_code == 200, response.content
    assert mail.outbox and "2026-11-09-2026-11-09" in mail.outbox[-1].attachments[0][0]
    bad = client_for(admin).post(
        "/api/reporting/export/collections/email/",
        {"to": "reports@example.com", "period_start": "2026-11-09", "period_end": "2026-11-01"}, format="json",
    )
    assert bad.status_code == 400


@pytest.mark.django_db
def test_date_context_endpoint(agent, company):
    from django.utils import timezone

    company_obj, _ = company
    company_obj.fy_start_month = 1
    company_obj.save(update_fields=["fy_start_month"])
    data = client_for(agent).get("/api/reporting/date-context/").json()
    assert data["timezone"] == "Asia/Kolkata"
    assert data["fy_start_month"] == 1
    assert data["max_span_days"] == 366
    assert data["today"] == timezone.localdate(timezone=IST).isoformat()
    assert APIClient().get("/api/reporting/date-context/").status_code == 401


@pytest.mark.django_db
def test_date_context_defaults_to_april_without_company(agent):
    assert client_for(agent).get("/api/reporting/date-context/").json()["fy_start_month"] == 4


def test_label_variants():
    assert DateRange(date(2026, 4, 1), None).label() == "from 2026-04-01"
    assert DateRange(None, date(2026, 4, 1)).label() == "up to 2026-04-01"
    assert DateRange(date(2026, 4, 1), date(2026, 4, 1) + timedelta(days=1)).label() == "2026-04-01 to 2026-04-02"
