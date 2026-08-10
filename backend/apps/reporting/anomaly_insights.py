"""§20.1 AI dashboard anomaly insights: rather than a black-box "AI"
label on a number nobody can explain, this compares each of the Live
Dashboard's own headline metrics against its own recent history and
flags today's value only when it's a statistically real outlier — every
insight ships with the mean/stdev/z-score that produced it, so a
back-office user can see exactly why something was flagged. Computed on
read (same pattern as apps.reporting.alerts), no scheduled job."""

import statistics
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone

MIN_HISTORY_DAYS = 5
Z_SCORE_MEDIUM = 2.0
Z_SCORE_HIGH = 3.0
FLAT_BASELINE_RELATIVE_THRESHOLD = 0.5  # when stdev is 0, flag a >50% swing off a nonzero mean


def _daily_values(model, date_field, agg_field, agg_func, start, end):
    """Returns {date: value} for each day in [start, end), 0 for days
    with no matching rows — a day with zero sales is real history, not
    missing data, and must count toward the baseline."""
    rows = (
        model.objects.filter(**{f"{date_field}__gte": start, f"{date_field}__lt": end})
        .values(date_field)
        .annotate(value=agg_func(agg_field))
    )
    by_date = {row[date_field]: (row["value"] or 0) for row in rows}
    return {start + timedelta(days=i): by_date.get(start + timedelta(days=i), 0) for i in range((end - start).days)}


def _score(metric_key, label, today_value, history_values, unit):
    history_values = [float(v) for v in history_values]
    today_value = float(today_value)
    # Days with zero activity are real history (see _daily_values), but a
    # deployment that's only had a handful of active days so far doesn't
    # have enough of a pattern yet to call anything an "outlier".
    if sum(1 for v in history_values if v != 0) < MIN_HISTORY_DAYS:
        return None

    mean = statistics.fmean(history_values)
    stdev = statistics.pstdev(history_values)

    if stdev > 0:
        z_score = (today_value - mean) / stdev
    elif mean > 0 and abs(today_value - mean) / mean > FLAT_BASELINE_RELATIVE_THRESHOLD:
        # A perfectly flat history (stdev=0) has no real z-score — scale
        # a proxy proportionally to the relative swing instead of a flat
        # guess, so a 2x blip and a 50x blip aren't reported identically.
        relative_deviation = abs(today_value - mean) / mean
        z_score = Z_SCORE_MEDIUM * relative_deviation / FLAT_BASELINE_RELATIVE_THRESHOLD
        if today_value < mean:
            z_score = -z_score
    else:
        z_score = 0.0

    if abs(z_score) < Z_SCORE_MEDIUM:
        return None

    severity = "high" if abs(z_score) >= Z_SCORE_HIGH else "medium"
    direction = "spike" if z_score > 0 else "drop"
    return {
        "metric": metric_key,
        "label": label,
        "today_value": today_value,
        "baseline_mean": round(mean, 2),
        "baseline_stdev": round(stdev, 2),
        "z_score": round(z_score, 2),
        "direction": direction,
        "severity": severity,
        "unit": unit,
        "explanation": (
            f"Today's {label.lower()} ({unit}{today_value:,.0f}) is a {direction} versus the "
            f"{len(history_values)}-day average ({unit}{mean:,.0f}), {abs(z_score):.1f} standard "
            f"deviations {'above' if z_score > 0 else 'below'} baseline."
        ),
    }


def dashboard_anomaly_insights(lookback_days: int = 14) -> list[dict]:
    from apps.attendance.models import Attendance
    from apps.fleet.models import Trip
    from apps.sales.models import Invoice, Receipt

    today = timezone.localdate()
    history_start = today - timedelta(days=lookback_days)

    sales_by_day = _daily_values(Invoice, "invoice_date", "grand_total", Sum, history_start, today)
    sales_count_by_day = _daily_values(Invoice, "invoice_date", "id", Count, history_start, today)
    collections_by_day = _daily_values(Receipt, "received_at__date", "amount", Sum, history_start, today)
    trips_by_day = _daily_values(Trip, "start_time__date", "id", Count, history_start, today)
    checkins_by_day = _daily_values(Attendance, "check_in_at__date", "id", Count, history_start, today)

    todays_sales = Invoice.objects.filter(invoice_date=today).aggregate(t=Sum("grand_total"))["t"] or Decimal("0")
    todays_sales_count = Invoice.objects.filter(invoice_date=today).count()
    todays_collections = Receipt.objects.filter(received_at__date=today).aggregate(t=Sum("amount"))["t"] or Decimal("0")
    todays_trips = Trip.objects.filter(start_time__date=today).count()
    todays_checkins = Attendance.objects.filter(check_in_at__date=today).count()

    candidates = [
        ("sales_total", "Sales total", todays_sales, sales_by_day.values(), "₹"),
        ("sales_count", "Invoice count", todays_sales_count, sales_count_by_day.values(), ""),
        ("collections_total", "Collections total", todays_collections, collections_by_day.values(), "₹"),
        ("trips_started", "Trips started", todays_trips, trips_by_day.values(), ""),
        ("checkins", "Agent check-ins", todays_checkins, checkins_by_day.values(), ""),
    ]

    insights = [_score(*candidate) for candidate in candidates]
    return sorted((i for i in insights if i), key=lambda i: -abs(i["z_score"]))
