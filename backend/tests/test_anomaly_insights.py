"""§20.1 AI dashboard anomaly insights: verifies the statistical scoring
(insufficient-history skip, flat-baseline relative-swing detection,
z-score threshold/severity) and the API endpoint."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.reporting.anomaly_insights import dashboard_anomaly_insights
from apps.sales.models import Invoice


def _make_invoice(company, agent, van_godown, customer, invoice_date, grand_total):
    _, gst_registration = company
    return Invoice.objects.create(
        customer=customer, agent=agent, godown=van_godown, gst_registration=gst_registration,
        place_of_supply_state=gst_registration.state, invoice_date=invoice_date,
        subtotal=Decimal(grand_total), grand_total=Decimal(grand_total),
    )


@pytest.mark.django_db
def test_insufficient_history_returns_no_sales_insight(company, agent, van_godown, customer):
    today = date.today()
    # Only 3 days of history — below MIN_HISTORY_DAYS=5.
    for offset in range(1, 4):
        _make_invoice(company, agent, van_godown, customer, today - timedelta(days=offset), "1000")
    _make_invoice(company, agent, van_godown, customer, today, "50000")

    insights = dashboard_anomaly_insights()
    assert not any(i["metric"] == "sales_total" for i in insights)


@pytest.mark.django_db
def test_flags_sales_spike_above_baseline(company, agent, van_godown, customer):
    today = date.today()
    for offset in range(1, 15):
        _make_invoice(company, agent, van_godown, customer, today - timedelta(days=offset), "1000")
    _make_invoice(company, agent, van_godown, customer, today, "50000")

    insights = dashboard_anomaly_insights()
    sales_insight = next(i for i in insights if i["metric"] == "sales_total")
    assert sales_insight["direction"] == "spike"
    assert sales_insight["severity"] == "high"
    assert sales_insight["z_score"] > 0


@pytest.mark.django_db
def test_no_insight_when_today_matches_baseline(company, agent, van_godown, customer):
    today = date.today()
    for offset in range(0, 15):
        _make_invoice(company, agent, van_godown, customer, today - timedelta(days=offset), "1000")

    insights = dashboard_anomaly_insights()
    assert not any(i["metric"] == "sales_total" for i in insights)


@pytest.mark.django_db
def test_flat_baseline_relative_swing_is_flagged(company, agent, van_godown, customer):
    today = date.today()
    # Perfectly flat history (stdev=0) — z-score is undefined, but a big
    # swing off a nonzero flat baseline should still be caught.
    for offset in range(1, 15):
        _make_invoice(company, agent, van_godown, customer, today - timedelta(days=offset), "1000")
    _make_invoice(company, agent, van_godown, customer, today, "5000")

    insights = dashboard_anomaly_insights()
    sales_insight = next(i for i in insights if i["metric"] == "sales_total")
    assert sales_insight["baseline_stdev"] == 0
    assert sales_insight["direction"] == "spike"


@pytest.mark.django_db
def test_anomaly_insights_endpoint_requires_permission(agent):
    client = APIClient()
    client.force_authenticate(user=agent)
    response = client.get("/api/reporting/anomaly-insights/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_anomaly_insights_endpoint_returns_insights_key(supervisor):
    client = APIClient()
    client.force_authenticate(user=supervisor)
    response = client.get("/api/reporting/anomaly-insights/")
    assert response.status_code == 200
    assert "insights" in response.data
