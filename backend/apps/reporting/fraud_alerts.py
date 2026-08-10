"""§20.6 Fraud & anomaly detection: explainable, rule-based checks for
patterns that look like abuse rather than ordinary sales variance —
per-agent discount patterns, "sellable" return frequency, GPS-spoofed
outlet check-ins, and physically-impossible travel between GPS pings.
Computed on read, same posture as apps.reporting.alerts/anomaly_insights
— every flagged item carries the numbers that produced it, not a bare
score, so a supervisor can see exactly why it was raised.

Distinguished from apps.reporting.alerts.unusual_discount_alerts, which
flags a single invoice against a fixed threshold: the checks here look
for a *pattern* across many transactions per agent — one big discount is
normal business, the same agent discounting far above their peers on
every invoice for a month is the fraud-relevant signal."""

import statistics
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from apps.core.geo import haversine_km

DISCOUNT_PATTERN_LOOKBACK_DAYS = 30
DISCOUNT_PATTERN_MIN_INVOICES = 5
DISCOUNT_PATTERN_RATIO_THRESHOLD = 1.5

RETURN_FREQUENCY_LOOKBACK_DAYS = 30
RETURN_FREQUENCY_MIN_INVOICES = 5
SELLABLE_RETURN_RATIO_THRESHOLD = 0.15

CHECKIN_SPOOF_LOOKBACK_DAYS = 7
CHECKIN_SPOOF_MAX_DISTANCE_KM = 1.0

IMPOSSIBLE_TRAVEL_LOOKBACK_HOURS = 24
IMPOSSIBLE_TRAVEL_MAX_SPEED_KMH = 120.0
IMPOSSIBLE_TRAVEL_MIN_MINUTES = 1.0  # below this, GPS jitter alone can imply an unrealistic speed


def discount_pattern_alerts(
    days: int = DISCOUNT_PATTERN_LOOKBACK_DAYS,
    min_invoices: int = DISCOUNT_PATTERN_MIN_INVOICES,
    ratio_threshold: float = DISCOUNT_PATTERN_RATIO_THRESHOLD,
) -> list[dict]:
    """Agents whose average discount% across the window is well above the
    fleet-wide average for the same window — a sustained pattern, not the
    single-invoice spike unusual_discount_alerts already covers."""
    from apps.accounts.models import User
    from apps.sales.models import Invoice

    since = timezone.now().date() - timedelta(days=days)
    invoices = Invoice.objects.filter(invoice_date__gte=since, subtotal__gt=0).values(
        "agent_id", "subtotal", "discount_total"
    )

    per_agent = {}
    for inv in invoices:
        pct = float(inv["discount_total"]) / float(inv["subtotal"]) * 100
        per_agent.setdefault(inv["agent_id"], []).append(pct)

    fleet_pcts = [pct for pcts in per_agent.values() for pct in pcts]
    if not fleet_pcts:
        return []
    fleet_avg = statistics.fmean(fleet_pcts)
    if fleet_avg <= 0:
        return []

    agents_by_id = {u.id: u for u in User.objects.filter(id__in=per_agent.keys())}
    alerts = []
    for agent_id, pcts in per_agent.items():
        if len(pcts) < min_invoices:
            continue
        avg_pct = statistics.fmean(pcts)
        ratio = avg_pct / fleet_avg
        if ratio >= ratio_threshold:
            agent_user = agents_by_id[agent_id]
            alerts.append({
                "agent_id": agent_id,
                "agent_name": agent_user.get_full_name() or agent_user.username,
                "invoice_count": len(pcts),
                "avg_discount_pct": round(avg_pct, 1),
                "fleet_avg_discount_pct": round(fleet_avg, 1),
                "ratio_to_fleet_avg": round(ratio, 2),
            })
    alerts.sort(key=lambda a: -a["ratio_to_fleet_avg"])
    return alerts


def return_frequency_alerts(
    days: int = RETURN_FREQUENCY_LOOKBACK_DAYS,
    min_invoices: int = RETURN_FREQUENCY_MIN_INVOICES,
    ratio_threshold: float = SELLABLE_RETURN_RATIO_THRESHOLD,
) -> list[dict]:
    """Agents with an unusually high rate of credit notes returned in
    'sellable' condition — a return for damaged/expired stock is ordinary
    business (see CreditNoteLine.condition), but a high volume of returns
    claimed as fully sellable is the pattern associated with fake sales
    or diverted stock, since nothing was actually wrong with what came
    back."""
    from apps.accounts.models import User
    from apps.sales.models import CreditNote, CreditNoteLine, Invoice

    since = timezone.now().date() - timedelta(days=days)

    invoice_counts = dict(
        Invoice.objects.filter(invoice_date__gte=since)
        .values("agent_id").annotate(n=Count("id")).values_list("agent_id", "n")
    )
    sellable_counts = dict(
        CreditNoteLine.objects.filter(
            credit_note__note_date__gte=since, condition=CreditNote.CONDITION_SELLABLE,
        )
        .values("credit_note__agent_id").annotate(n=Count("id")).values_list("credit_note__agent_id", "n")
    )

    agents_by_id = {u.id: u for u in User.objects.filter(id__in=invoice_counts.keys())}
    alerts = []
    for agent_id, invoice_count in invoice_counts.items():
        if invoice_count < min_invoices:
            continue
        sellable_count = sellable_counts.get(agent_id, 0)
        if sellable_count == 0:
            continue
        ratio = sellable_count / invoice_count
        if ratio >= ratio_threshold:
            agent_user = agents_by_id[agent_id]
            alerts.append({
                "agent_id": agent_id,
                "agent_name": agent_user.get_full_name() or agent_user.username,
                "invoice_count": invoice_count,
                "sellable_return_count": sellable_count,
                "sellable_return_ratio": round(ratio, 2),
            })
    alerts.sort(key=lambda a: -a["sellable_return_ratio"])
    return alerts


def spoofed_checkin_alerts(
    days: int = CHECKIN_SPOOF_LOOKBACK_DAYS,
    max_distance_km: float = CHECKIN_SPOOF_MAX_DISTANCE_KM,
) -> list[dict]:
    """Outlet check-ins whose GPS coordinates land well outside the
    customer's registered address — the signature of a check-in faked
    with a mock-location app rather than a real visit. Only compares
    against customers with a geocoded address; un-geocoded outlets are
    silently skipped rather than false-flagged. A customer with more than
    one address (CustomerAddress) is compared against its most recently
    added one — this MVP has no "primary address" designation."""
    from apps.customers.models import CustomerAddress
    from apps.fleet.models import TripCheckpoint

    since = timezone.now() - timedelta(days=days)
    checkpoints = (
        TripCheckpoint.objects.filter(
            check_in_time__gte=since, check_in_latitude__isnull=False, check_in_longitude__isnull=False,
        )
        .select_related("customer", "trip", "trip__agent")
    )

    address_by_customer = {
        a.customer_id: a
        for a in CustomerAddress.objects.filter(latitude__isnull=False, longitude__isnull=False).order_by("id")
    }

    alerts = []
    for cp in checkpoints:
        address = address_by_customer.get(cp.customer_id)
        if address is None:
            continue
        distance_km = haversine_km(
            float(cp.check_in_latitude), float(cp.check_in_longitude),
            float(address.latitude), float(address.longitude),
        )
        if distance_km >= max_distance_km:
            alerts.append({
                "checkpoint_id": cp.id,
                "trip_id": cp.trip_id,
                "agent_name": cp.trip.agent.get_full_name() or cp.trip.agent.username,
                "customer_id": cp.customer_id,
                "customer_name": cp.customer.name,
                "check_in_time": cp.check_in_time,
                "distance_km": round(distance_km, 2),
            })
    alerts.sort(key=lambda a: -a["distance_km"])
    return alerts


def impossible_travel_alerts(
    hours: int = IMPOSSIBLE_TRAVEL_LOOKBACK_HOURS,
    max_speed_kmh: float = IMPOSSIBLE_TRAVEL_MAX_SPEED_KMH,
) -> list[dict]:
    """Consecutive GPS pings from the same agent that imply a speed no
    real vehicle could sustain — the signature of a spoofed/mocked
    location jumping between two points rather than a genuine drive."""
    from apps.accounts.models import User
    from apps.fleet.models import LocationPing

    since = timezone.now() - timedelta(hours=hours)
    pings = LocationPing.objects.filter(recorded_at__gte=since).order_by("agent_id", "recorded_at")

    by_agent = {}
    for ping in pings:
        by_agent.setdefault(ping.agent_id, []).append(ping)

    agents_by_id = {u.id: u for u in User.objects.filter(id__in=by_agent.keys())}
    alerts = []
    for agent_id, agent_pings in by_agent.items():
        for prev, curr in zip(agent_pings, agent_pings[1:]):
            elapsed_minutes = (curr.recorded_at - prev.recorded_at).total_seconds() / 60
            if elapsed_minutes < IMPOSSIBLE_TRAVEL_MIN_MINUTES:
                continue
            distance_km = haversine_km(
                float(prev.latitude), float(prev.longitude), float(curr.latitude), float(curr.longitude)
            )
            implied_speed_kmh = distance_km / (elapsed_minutes / 60)
            if implied_speed_kmh >= max_speed_kmh:
                agent_user = agents_by_id[agent_id]
                alerts.append({
                    "agent_id": agent_id,
                    "agent_name": agent_user.get_full_name() or agent_user.username,
                    "from_time": prev.recorded_at,
                    "to_time": curr.recorded_at,
                    "distance_km": round(distance_km, 2),
                    "elapsed_minutes": round(elapsed_minutes, 1),
                    "implied_speed_kmh": round(implied_speed_kmh, 1),
                })
    alerts.sort(key=lambda a: -a["implied_speed_kmh"])
    return alerts


def fraud_alerts_summary() -> dict:
    return {
        "discount_patterns": discount_pattern_alerts(),
        "return_frequency": return_frequency_alerts(),
        "spoofed_checkins": spoofed_checkin_alerts(),
        "impossible_travel": impossible_travel_alerts(),
    }
