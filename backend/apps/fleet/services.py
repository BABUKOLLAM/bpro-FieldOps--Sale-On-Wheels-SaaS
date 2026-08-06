from decimal import Decimal

from django.db.models import Avg
from django.utils import timezone

from .models import FuelLog, OdometerLog, Trip


def start_trip(trip: Trip, *, odometer=None, latitude=None, longitude=None, photo=None):
    trip.status = Trip.STATUS_IN_PROGRESS
    trip.start_time = timezone.now()
    trip.start_odometer = odometer
    trip.start_latitude = latitude
    trip.start_longitude = longitude
    trip.save(update_fields=["status", "start_time", "start_odometer", "start_latitude", "start_longitude"])

    if odometer is not None and trip.vehicle_id:
        OdometerLog.objects.create(
            vehicle=trip.vehicle, trip=trip, reading_type=OdometerLog.READING_START,
            reading=odometer, photo=photo,
        )
    return trip


def end_trip(trip: Trip, *, odometer=None, latitude=None, longitude=None, photo=None):
    trip.status = Trip.STATUS_COMPLETED
    trip.end_time = timezone.now()
    trip.end_odometer = odometer
    trip.end_latitude = latitude
    trip.end_longitude = longitude
    trip.save(update_fields=["status", "end_time", "end_odometer", "end_latitude", "end_longitude"])

    if odometer is not None and trip.vehicle_id:
        OdometerLog.objects.create(
            vehicle=trip.vehicle, trip=trip, reading_type=OdometerLog.READING_END,
            reading=odometer, photo=photo,
        )
    return trip


# Fill-ups more than this many percentage points below the vehicle's own
# historical average km/l are flagged for a supervisor to review — not
# auto-rejected, since the field agent's own workflow must never be blocked
# (BRD FR-11: offline/uninterrupted operation is a hard requirement).
PILFERAGE_DEVIATION_THRESHOLD = Decimal("0.35")


def evaluate_fuel_log(fuel_log: FuelLog) -> FuelLog:
    """Flags a fuel log if its implied efficiency deviates sharply below
    the vehicle's historical average — a low-cost proxy for FM-04's
    "abnormal consumption that may indicate pilferage"."""
    previous = (
        FuelLog.objects.filter(vehicle=fuel_log.vehicle)
        .exclude(pk=fuel_log.pk)
        .order_by("-odometer_reading")
        .first()
    )
    if not previous or fuel_log.odometer_reading <= previous.odometer_reading:
        return fuel_log

    distance = fuel_log.odometer_reading - previous.odometer_reading
    if fuel_log.fuel_qty_litres <= 0:
        return fuel_log
    this_efficiency = distance / fuel_log.fuel_qty_litres

    avg_efficiency = (
        FuelLog.objects.filter(vehicle=fuel_log.vehicle)
        .exclude(pk=fuel_log.pk)
        .aggregate(avg=Avg("fuel_qty_litres"))["avg"]
    )
    # Not enough history yet to have a meaningful baseline.
    history_count = FuelLog.objects.filter(vehicle=fuel_log.vehicle).exclude(pk=fuel_log.pk).count()
    if avg_efficiency is None or history_count < 3:
        return fuel_log

    baseline = FuelLog.objects.filter(vehicle=fuel_log.vehicle).exclude(pk=fuel_log.pk).order_by("-odometer_reading")[:5]
    baseline_efficiencies = []
    rows = list(baseline)
    for i in range(len(rows) - 1):
        d = rows[i].odometer_reading - rows[i + 1].odometer_reading
        if rows[i].fuel_qty_litres > 0 and d > 0:
            baseline_efficiencies.append(d / rows[i].fuel_qty_litres)
    if not baseline_efficiencies:
        return fuel_log

    baseline_avg = sum(baseline_efficiencies) / len(baseline_efficiencies)
    if baseline_avg > 0 and this_efficiency < baseline_avg * (1 - PILFERAGE_DEVIATION_THRESHOLD):
        fuel_log.flagged_for_review = True
        fuel_log.flag_reason = (
            f"Efficiency {this_efficiency:.2f} km/l is more than "
            f"{int(PILFERAGE_DEVIATION_THRESHOLD * 100)}% below this vehicle's recent "
            f"average of {baseline_avg:.2f} km/l."
        )
        fuel_log.save(update_fields=["flagged_for_review", "flag_reason"])
    return fuel_log
