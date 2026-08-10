"""AR-11 Alerts & Exception Reporting: stock variance, unusual
discounts, missed visits, and prolonged agent inactivity — the service
functions directly, the admin-web-facing endpoint, and the matching
report-export entries."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Beat, BeatCustomer, Customer
from apps.fleet.models import Trip, TripCheckpoint
from apps.inventory.models import StockLedgerEntry
from apps.inventory.services import post_stock_movement
from apps.reporting.alerts import (
    inactive_agent_alerts, missed_visit_alerts, stock_variance_alerts, unusual_discount_alerts,
)
from apps.sales.models import Invoice, InvoiceLine
from apps.sales.services import finalize_invoice


@pytest.fixture
def beat_with_stop(agent):
    beat = Beat.objects.create(name="AR-11 Test Beat", assigned_agent=agent)
    cust1 = Customer.objects.create(code="AR11-C1", name="Stop One", credit_limit=0, credit_days=0)
    cust2 = Customer.objects.create(code="AR11-C2", name="Stop Two", credit_limit=0, credit_days=0)
    BeatCustomer.objects.create(beat=beat, customer=cust1, visit_sequence=1)
    BeatCustomer.objects.create(beat=beat, customer=cust2, visit_sequence=2)
    return beat, cust1, cust2


# ---- stock variance ----


@pytest.mark.django_db
def test_stock_variance_alerts_surfaces_adjustment_entries(van_godown, item):
    post_stock_movement(godown=van_godown, item=item, qty=Decimal("-3"), txn_type=StockLedgerEntry.TXN_ADJUSTMENT)
    alerts = stock_variance_alerts()
    assert len(alerts) == 1
    assert alerts[0]["item_sku"] == item.sku
    assert alerts[0]["qty"] == Decimal("-3")


@pytest.mark.django_db
def test_stock_variance_alerts_ignores_non_adjustment_entries(van_godown, item):
    post_stock_movement(godown=van_godown, item=item, qty=Decimal("-3"), txn_type=StockLedgerEntry.TXN_SALE)
    assert stock_variance_alerts() == []


@pytest.mark.django_db
def test_stock_variance_alerts_ignores_tiny_adjustments(van_godown, item):
    post_stock_movement(godown=van_godown, item=item, qty=Decimal("0.5"), txn_type=StockLedgerEntry.TXN_ADJUSTMENT)
    assert stock_variance_alerts() == []


# ---- unusual discounts ----


@pytest.mark.django_db
def test_unusual_discount_alerts_flags_high_discount_invoice(company, agent, van_godown, item, customer):
    _, gst_registration = company
    invoice = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
        subtotal=Decimal("1000"), discount_total=Decimal("250"), grand_total=Decimal("750"),
    )
    alerts = unusual_discount_alerts()
    assert len(alerts) == 1
    assert alerts[0]["invoice_id"] == invoice.id
    assert alerts[0]["discount_pct"] == Decimal("25.0")


@pytest.mark.django_db
def test_unusual_discount_alerts_ignores_normal_discount(company, agent, van_godown, item, customer):
    _, gst_registration = company
    Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
        subtotal=Decimal("1000"), discount_total=Decimal("50"), grand_total=Decimal("950"),
    )
    assert unusual_discount_alerts() == []


@pytest.mark.django_db
def test_unusual_discount_alerts_respects_lookback_window(company, agent, van_godown, item, customer):
    _, gst_registration = company
    Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today() - timedelta(days=30),
        subtotal=Decimal("1000"), discount_total=Decimal("500"), grand_total=Decimal("500"),
    )
    assert unusual_discount_alerts(days=7) == []


# ---- missed visits ----


@pytest.mark.django_db
def test_missed_visit_alerts_flags_stop_with_no_checkin(agent, beat_with_stop):
    beat, cust1, cust2 = beat_with_stop
    trip = Trip.objects.create(agent=agent, beat=beat, status=Trip.STATUS_IN_PROGRESS, start_time=timezone.now())
    TripCheckpoint.objects.create(trip=trip, customer=cust1, check_in_time=timezone.now())
    # cust2 never checked in.

    alerts = missed_visit_alerts(for_date=timezone.localdate())
    assert len(alerts) == 1
    assert alerts[0]["customer_id"] == cust2.id


@pytest.mark.django_db
def test_missed_visit_alerts_empty_when_all_checked_in(agent, beat_with_stop):
    beat, cust1, cust2 = beat_with_stop
    trip = Trip.objects.create(agent=agent, beat=beat, status=Trip.STATUS_COMPLETED, start_time=timezone.now())
    TripCheckpoint.objects.create(trip=trip, customer=cust1, check_in_time=timezone.now())
    TripCheckpoint.objects.create(trip=trip, customer=cust2, check_in_time=timezone.now())

    assert missed_visit_alerts(for_date=timezone.localdate()) == []


@pytest.mark.django_db
def test_missed_visit_alerts_ignores_trip_with_no_beat(agent):
    Trip.objects.create(agent=agent, status=Trip.STATUS_IN_PROGRESS, start_time=timezone.now())
    assert missed_visit_alerts(for_date=timezone.localdate()) == []


# ---- inactive agents ----


@pytest.mark.django_db
def test_inactive_agent_alerts_flags_agent_with_no_activity(agent):
    alerts = inactive_agent_alerts(days=3)
    assert any(a["agent_id"] == agent.id for a in alerts)
    flagged = next(a for a in alerts if a["agent_id"] == agent.id)
    assert flagged["last_activity_at"] is None
    assert flagged["days_inactive"] is None


@pytest.mark.django_db
def test_inactive_agent_alerts_excludes_recently_active_agent(company, agent, van_godown, item, customer):
    _, gst_registration = company
    invoice = Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=date.today(),
    )
    InvoiceLine.objects.create(invoice=invoice, item=item, qty=Decimal("1"), rate=Decimal("10.00"))
    finalize_invoice(invoice)

    alerts = inactive_agent_alerts(days=3)
    assert not any(a["agent_id"] == agent.id for a in alerts)


# ---- API endpoint ----


@pytest.mark.django_db
def test_exception_alerts_endpoint_returns_all_four_categories(supervisor):
    client = APIClient()
    client.force_authenticate(user=supervisor)
    response = client.get("/api/reporting/alerts/")
    assert response.status_code == 200
    assert set(response.data.keys()) == {"stock_variance", "unusual_discounts", "missed_visits", "inactive_agents"}


@pytest.mark.django_db
def test_exception_alerts_endpoint_requires_permission(agent):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get("/api/reporting/alerts/")
    assert response.status_code == 403


# ---- report-export registration ----


@pytest.mark.django_db
def test_alert_report_keys_are_exportable(supervisor, van_godown, item):
    post_stock_movement(godown=van_godown, item=item, qty=Decimal("-5"), txn_type=StockLedgerEntry.TXN_ADJUSTMENT)
    client = APIClient()
    client.force_authenticate(user=supervisor)
    for report_key in ("stock_variance", "unusual_discounts", "missed_visits", "inactive_agents"):
        response = client.get(f"/api/reporting/export/{report_key}/?filetype=xlsx")
        assert response.status_code == 200, f"{report_key}: {response.status_code}"
        assert response["Content-Type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
