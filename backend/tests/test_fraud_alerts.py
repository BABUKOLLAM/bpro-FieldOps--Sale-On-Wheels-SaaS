"""§20.6 Fraud & anomaly detection: per-agent discount patterns,
sellable-return frequency, GPS-spoofed outlet check-ins, and
physically-impossible travel between GPS pings — the service functions
directly and the admin-web-facing endpoint."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import CustomerAddress
from apps.fleet.models import LocationPing, Trip, TripCheckpoint
from apps.reporting.fraud_alerts import (
    discount_pattern_alerts, impossible_travel_alerts, return_frequency_alerts, spoofed_checkin_alerts,
)
from apps.sales.models import CreditNote, CreditNoteLine, Invoice


@pytest.fixture
def second_agent(db):
    from apps.accounts.models import User

    return User.objects.create_user(username="second-agent@test.local", password="testpass123", is_field_agent=True)


def _make_invoice(company, agent, van_godown, customer, subtotal, discount, invoice_date=None):
    _, gst_registration = company
    return Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=invoice_date or date.today(),
        subtotal=Decimal(subtotal), discount_total=Decimal(discount),
        grand_total=Decimal(subtotal) - Decimal(discount),
    )


# ---- discount patterns ----


@pytest.mark.django_db
def test_discount_pattern_alerts_flags_agent_above_fleet_average(company, agent, second_agent, van_godown, customer):
    for _ in range(5):
        _make_invoice(company, agent, van_godown, customer, "1000", "300")  # 30%
    for _ in range(5):
        _make_invoice(company, second_agent, van_godown, customer, "1000", "50")  # 5%

    alerts = discount_pattern_alerts()
    flagged_ids = {a["agent_id"] for a in alerts}
    assert agent.id in flagged_ids
    assert second_agent.id not in flagged_ids


@pytest.mark.django_db
def test_discount_pattern_alerts_respects_min_invoices(company, agent, second_agent, van_godown, customer):
    for _ in range(3):
        _make_invoice(company, agent, van_godown, customer, "1000", "300")  # 30%, but only 3 invoices
    for _ in range(5):
        _make_invoice(company, second_agent, van_godown, customer, "1000", "50")

    alerts = discount_pattern_alerts()
    assert agent.id not in {a["agent_id"] for a in alerts}


@pytest.mark.django_db
def test_discount_pattern_alerts_respects_lookback_window(company, agent, second_agent, van_godown, customer):
    old_date = date.today() - timedelta(days=60)
    for _ in range(5):
        _make_invoice(company, agent, van_godown, customer, "1000", "300", invoice_date=old_date)
    for _ in range(5):
        _make_invoice(company, second_agent, van_godown, customer, "1000", "50")

    alerts = discount_pattern_alerts(days=30)
    assert agent.id not in {a["agent_id"] for a in alerts}


# ---- return frequency ----


@pytest.mark.django_db
def test_return_frequency_alerts_flags_high_sellable_return_ratio(company, agent, van_godown, item, customer):
    invoices = [_make_invoice(company, agent, van_godown, customer, "1000", "0") for _ in range(5)]
    credit_note = CreditNote.objects.create(
        original_invoice=invoices[0], customer=customer, agent=agent, reason_code="customer_refused",
        note_date=date.today(),
    )
    CreditNoteLine.objects.create(
        credit_note=credit_note, item=item, qty=Decimal("1"), rate=Decimal("100"),
        condition=CreditNote.CONDITION_SELLABLE, line_total=Decimal("100"),
    )

    alerts = return_frequency_alerts()
    flagged = next(a for a in alerts if a["agent_id"] == agent.id)
    assert flagged["sellable_return_count"] == 1
    assert flagged["invoice_count"] == 5


@pytest.mark.django_db
def test_return_frequency_alerts_ignores_damaged_returns(company, agent, van_godown, item, customer):
    invoices = [_make_invoice(company, agent, van_godown, customer, "1000", "0") for _ in range(5)]
    credit_note = CreditNote.objects.create(
        original_invoice=invoices[0], customer=customer, agent=agent, reason_code="damaged_in_transit",
        note_date=date.today(),
    )
    CreditNoteLine.objects.create(
        credit_note=credit_note, item=item, qty=Decimal("1"), rate=Decimal("100"),
        condition=CreditNote.CONDITION_DAMAGED, line_total=Decimal("100"),
    )

    alerts = return_frequency_alerts()
    assert agent.id not in {a["agent_id"] for a in alerts}


@pytest.mark.django_db
def test_return_frequency_alerts_respects_min_invoices(company, agent, van_godown, item, customer):
    invoices = [_make_invoice(company, agent, van_godown, customer, "1000", "0") for _ in range(3)]
    credit_note = CreditNote.objects.create(
        original_invoice=invoices[0], customer=customer, agent=agent, reason_code="customer_refused",
        note_date=date.today(),
    )
    CreditNoteLine.objects.create(
        credit_note=credit_note, item=item, qty=Decimal("1"), rate=Decimal("100"),
        condition=CreditNote.CONDITION_SELLABLE, line_total=Decimal("100"),
    )

    alerts = return_frequency_alerts()
    assert agent.id not in {a["agent_id"] for a in alerts}


# ---- spoofed check-ins ----


@pytest.mark.django_db
def test_spoofed_checkin_alerts_flags_far_checkin(agent, customer):
    CustomerAddress.objects.create(customer=customer, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"))
    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_IN_PROGRESS, start_time=timezone.now())
    TripCheckpoint.objects.create(
        trip=trip, customer=customer, check_in_time=timezone.now(),
        check_in_latitude=Decimal("19.120000"), check_in_longitude=Decimal("72.877700"),  # ~4.9km away
    )

    alerts = spoofed_checkin_alerts()
    assert len(alerts) == 1
    assert alerts[0]["customer_id"] == customer.id
    assert alerts[0]["distance_km"] > 1.0


@pytest.mark.django_db
def test_spoofed_checkin_alerts_ignores_nearby_checkin(agent, customer):
    CustomerAddress.objects.create(customer=customer, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"))
    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_IN_PROGRESS, start_time=timezone.now())
    TripCheckpoint.objects.create(
        trip=trip, customer=customer, check_in_time=timezone.now(),
        check_in_latitude=Decimal("19.076500"), check_in_longitude=Decimal("72.878000"),  # ~100m away
    )

    assert spoofed_checkin_alerts() == []


@pytest.mark.django_db
def test_spoofed_checkin_alerts_skips_ungeocoded_customer(agent, customer):
    trip = Trip.objects.create(agent=agent, status=Trip.STATUS_IN_PROGRESS, start_time=timezone.now())
    TripCheckpoint.objects.create(
        trip=trip, customer=customer, check_in_time=timezone.now(),
        check_in_latitude=Decimal("19.120000"), check_in_longitude=Decimal("72.877700"),
    )

    assert spoofed_checkin_alerts() == []


# ---- impossible travel ----


@pytest.mark.django_db
def test_impossible_travel_alerts_flags_high_implied_speed(agent):
    now = timezone.now()
    LocationPing.objects.create(agent=agent, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"), recorded_at=now)
    LocationPing.objects.create(
        agent=agent, latitude=Decimal("19.121000"), longitude=Decimal("72.877700"),
        recorded_at=now + timedelta(minutes=1),  # ~5km in 1 minute = ~300km/h
    )

    alerts = impossible_travel_alerts()
    assert len(alerts) == 1
    assert alerts[0]["agent_id"] == agent.id
    assert alerts[0]["implied_speed_kmh"] > 120


@pytest.mark.django_db
def test_impossible_travel_alerts_ignores_plausible_speed(agent):
    now = timezone.now()
    LocationPing.objects.create(agent=agent, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"), recorded_at=now)
    LocationPing.objects.create(
        agent=agent, latitude=Decimal("19.086000"), longitude=Decimal("72.877700"),
        recorded_at=now + timedelta(minutes=10),  # ~1.1km in 10 minutes
    )

    assert impossible_travel_alerts() == []


@pytest.mark.django_db
def test_impossible_travel_alerts_skips_subminute_pairs(agent):
    now = timezone.now()
    LocationPing.objects.create(agent=agent, latitude=Decimal("19.076000"), longitude=Decimal("72.877700"), recorded_at=now)
    LocationPing.objects.create(
        agent=agent, latitude=Decimal("19.121000"), longitude=Decimal("72.877700"),
        recorded_at=now + timedelta(seconds=30),  # big jump, but under the minimum time-delta guard
    )

    assert impossible_travel_alerts() == []


# ---- API endpoint ----


@pytest.mark.django_db
def test_fraud_alerts_endpoint_returns_all_four_categories(supervisor):
    client = APIClient()
    client.force_authenticate(user=supervisor)
    response = client.get("/api/reporting/fraud-alerts/")
    assert response.status_code == 200
    assert set(response.data.keys()) == {
        "discount_patterns", "return_frequency", "spoofed_checkins", "impossible_travel",
    }


@pytest.mark.django_db
def test_fraud_alerts_endpoint_requires_permission(agent):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get("/api/reporting/fraud-alerts/")
    assert response.status_code == 403
