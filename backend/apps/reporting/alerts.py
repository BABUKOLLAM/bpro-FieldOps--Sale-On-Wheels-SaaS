"""AR-11 Alerts & Exception Reporting: automated alerts for stock
variance, unusual discounts, missed visits, and prolonged app
inactivity. Computed on read (no background job/websocket in this
build), same posture as apps.fleet.services' geofence_alerts/
maintenance_due_alerts — each function returns a list[dict], consumed
both by ExceptionAlertsView (a live admin-web page) and by four
matching report_builders entries (CSV/Excel/PDF/email, AR-02-style)."""

from datetime import timedelta
from decimal import Decimal

from django.db.models import Max
from django.utils import timezone

STOCK_VARIANCE_LOOKBACK_DAYS = 7
STOCK_VARIANCE_MIN_QTY = Decimal("1")
UNUSUAL_DISCOUNT_LOOKBACK_DAYS = 7
UNUSUAL_DISCOUNT_THRESHOLD_PCT = Decimal("15")
INACTIVITY_THRESHOLD_DAYS = 3


def stock_variance_alerts(days: int = STOCK_VARIANCE_LOOKBACK_DAYS) -> list[dict]:
    """Every stock 'adjustment' entry above a small materiality floor —
    TXN_ADJUSTMENT is, by construction, the transaction type posted when
    a physical/expected count didn't match (see
    apps.inventory.models.StockLedgerEntry), so it's the direct signal
    for "stock variance" rather than something inferred indirectly."""
    from apps.inventory.models import StockLedgerEntry

    since = timezone.now() - timedelta(days=days)
    entries = (
        StockLedgerEntry.objects.filter(txn_type=StockLedgerEntry.TXN_ADJUSTMENT, created_at__gte=since)
        .select_related("godown", "item")
        .order_by("-created_at")
    )
    return [
        {
            "entry_id": e.id,
            "godown_id": e.godown_id,
            "godown_name": e.godown.name,
            "item_sku": e.item.sku,
            "item_name": e.item.name,
            "qty": e.qty,
            "balance_after": e.balance_after,
            "recorded_at": e.created_at,
        }
        for e in entries
        if abs(e.qty) >= STOCK_VARIANCE_MIN_QTY
    ]


def unusual_discount_alerts(
    days: int = UNUSUAL_DISCOUNT_LOOKBACK_DAYS, threshold_pct: Decimal = UNUSUAL_DISCOUNT_THRESHOLD_PCT,
) -> list[dict]:
    """Invoices whose total discount is an unusually large share of the
    subtotal — a simple, explainable threshold rather than a per-agent
    statistical baseline, so a supervisor can see exactly why each one
    was flagged."""
    from apps.sales.models import Invoice

    since = timezone.now().date() - timedelta(days=days)
    alerts = []
    invoices = Invoice.objects.filter(invoice_date__gte=since, subtotal__gt=0).select_related("customer", "agent")
    for inv in invoices:
        discount_pct = (inv.discount_total / inv.subtotal) * 100
        if discount_pct >= threshold_pct:
            alerts.append({
                "invoice_id": inv.id,
                "invoice_no": inv.invoice_no or str(inv.id),
                "invoice_date": inv.invoice_date,
                "customer_name": inv.customer.name,
                "agent_name": inv.agent.get_full_name() or inv.agent.username,
                "subtotal": inv.subtotal,
                "discount_total": inv.discount_total,
                "discount_pct": round(discount_pct, 1),
            })
    alerts.sort(key=lambda a: a["discount_pct"], reverse=True)
    return alerts


def missed_visit_alerts(for_date=None) -> list[dict]:
    """Beat stops with no matching check-in on a trip that actually
    started that day. Does not flag a beat with no trip started at all —
    that's a planning gap, not yet a "missed visit" the way this BRD item
    means it (an agent skipped a stop mid-route)."""
    from apps.fleet.models import Trip, TripCheckpoint

    for_date = for_date or timezone.localdate()
    alerts = []
    trips = Trip.objects.filter(beat__isnull=False, start_time__date=for_date).select_related("beat", "agent")
    for trip in trips:
        checked_in_ids = set(
            TripCheckpoint.objects.filter(trip=trip, check_in_time__isnull=False).values_list("customer_id", flat=True)
        )
        stops = trip.beat.stops.select_related("customer").order_by("visit_sequence")
        for stop in stops:
            if stop.customer_id not in checked_in_ids:
                alerts.append({
                    "trip_id": trip.id,
                    "beat_id": trip.beat_id,
                    "beat_name": trip.beat.name,
                    "agent_name": trip.agent.get_full_name() or trip.agent.username,
                    "customer_id": stop.customer_id,
                    "customer_name": stop.customer.name,
                    "visit_sequence": stop.visit_sequence,
                    "date": for_date,
                })
    return alerts


def inactive_agent_alerts(days: int = INACTIVITY_THRESHOLD_DAYS) -> list[dict]:
    """Field agents with no invoice, trip, or GPS ping in the last N
    days — three aggregate queries (not one per agent) so this stays
    cheap at the fleet sizes the BRD's NFRs target (500 concurrent
    agents)."""
    from apps.accounts.models import User
    from apps.fleet.models import LocationPing, Trip
    from apps.sales.models import Invoice

    cutoff = timezone.now() - timedelta(days=days)
    agents = list(User.objects.filter(is_field_agent=True, is_active=True))
    if not agents:
        return []
    agent_ids = [a.id for a in agents]

    last_invoice = dict(
        Invoice.objects.filter(agent_id__in=agent_ids).values("agent_id").annotate(last=Max("created_at"))
        .values_list("agent_id", "last")
    )
    last_trip = dict(
        Trip.objects.filter(agent_id__in=agent_ids).values("agent_id").annotate(last=Max("created_at"))
        .values_list("agent_id", "last")
    )
    last_ping = dict(
        LocationPing.objects.filter(agent_id__in=agent_ids).values("agent_id").annotate(last=Max("recorded_at"))
        .values_list("agent_id", "last")
    )

    alerts = []
    for agent in agents:
        candidates = [d.get(agent.id) for d in (last_invoice, last_trip, last_ping) if d.get(agent.id)]
        last_activity = max(candidates) if candidates else None
        if last_activity is None or last_activity < cutoff:
            alerts.append({
                "agent_id": agent.id,
                "agent_name": agent.get_full_name() or agent.username,
                "last_activity_at": last_activity,
                "days_inactive": (timezone.now() - last_activity).days if last_activity else None,
            })
    alerts.sort(key=lambda a: (a["days_inactive"] is not None, a["days_inactive"]), reverse=True)
    return alerts


def exception_alerts_summary() -> dict:
    return {
        "stock_variance": stock_variance_alerts(),
        "unusual_discounts": unusual_discount_alerts(),
        "missed_visits": missed_visit_alerts(),
        "inactive_agents": inactive_agent_alerts(),
    }
