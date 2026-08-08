from decimal import Decimal

from django.db.models import Avg
from django.utils import timezone

from apps.core.geo import haversine_km

from .models import FuelLog, Geofence, LocationPing, MaintenanceSchedule, OdometerLog, Trip, VehicleDocument


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


# FM-05 maintenance due-alerts: a schedule can key off a calendar date, an
# odometer distance, or both — whichever is closer to "due" wins.
STATUS_OK = "ok"
STATUS_DUE_SOON = "due_soon"
STATUS_OVERDUE = "overdue"
_STATUS_RANK = {STATUS_OK: 0, STATUS_DUE_SOON: 1, STATUS_OVERDUE: 2}
DUE_SOON_DAYS = 14
DUE_SOON_KM = Decimal("500")


def _worse(a: str, b: str) -> str:
    return a if _STATUS_RANK[a] >= _STATUS_RANK[b] else b


def _latest_odometer_reading(vehicle):
    log = OdometerLog.objects.filter(vehicle=vehicle).order_by("-recorded_at").first()
    return log.reading if log else None


def maintenance_status(schedule: MaintenanceSchedule, current_odometer=None) -> str:
    """ok / due_soon / overdue for one schedule, given the vehicle's
    latest known odometer reading (pass None if unknown — the date check
    still applies on its own)."""
    status = STATUS_OK
    today = timezone.localdate()

    if schedule.next_due_date:
        days_remaining = (schedule.next_due_date - today).days
        if days_remaining < 0:
            status = _worse(status, STATUS_OVERDUE)
        elif days_remaining <= DUE_SOON_DAYS:
            status = _worse(status, STATUS_DUE_SOON)

    if schedule.next_due_odometer is not None and current_odometer is not None:
        km_remaining = schedule.next_due_odometer - current_odometer
        if km_remaining < 0:
            status = _worse(status, STATUS_OVERDUE)
        elif km_remaining <= DUE_SOON_KM:
            status = _worse(status, STATUS_DUE_SOON)

    return status


def maintenance_due_alerts(vehicle=None) -> list[dict]:
    """FM-05: every active schedule that's due_soon or overdue, across the
    fleet or scoped to one vehicle — so a fleet manager isn't manually
    eyeballing next_due_date/next_due_odometer on every vehicle."""
    schedules = MaintenanceSchedule.objects.filter(is_active=True).select_related("vehicle")
    if vehicle is not None:
        schedules = schedules.filter(vehicle=vehicle)

    odometer_cache: dict = {}
    alerts = []
    for schedule in schedules:
        if schedule.vehicle_id not in odometer_cache:
            odometer_cache[schedule.vehicle_id] = _latest_odometer_reading(schedule.vehicle)
        current_odometer = odometer_cache[schedule.vehicle_id]
        status = maintenance_status(schedule, current_odometer)
        if status != STATUS_OK:
            alerts.append({
                "schedule_id": schedule.id,
                "vehicle_id": schedule.vehicle_id,
                "vehicle_reg_no": schedule.vehicle.reg_no,
                "description": schedule.description,
                "next_due_date": schedule.next_due_date,
                "next_due_odometer": schedule.next_due_odometer,
                "current_odometer": current_odometer,
                "status": status,
            })
    return alerts


# FM-16 vehicle/driver document compliance — same due_soon/overdue shape
# as maintenance_due_alerts, mirrored deliberately for a consistent
# alert vocabulary across the fleet dashboard.
COMPLIANCE_DUE_SOON_DAYS = 30


def compliance_due_alerts(vehicle=None, agent=None) -> list[dict]:
    """FM-16: every active vehicle/driver document that's due_soon or
    overdue for renewal, across the fleet or scoped to one vehicle/agent."""
    documents = VehicleDocument.objects.filter(is_active=True).select_related("vehicle", "agent")
    if vehicle is not None:
        documents = documents.filter(vehicle=vehicle)
    if agent is not None:
        documents = documents.filter(agent=agent)

    today = timezone.localdate()
    alerts = []
    for doc in documents:
        days_remaining = (doc.expiry_date - today).days
        if days_remaining < 0:
            status = STATUS_OVERDUE
        elif days_remaining <= COMPLIANCE_DUE_SOON_DAYS:
            status = STATUS_DUE_SOON
        else:
            continue
        holder = doc.vehicle.reg_no if doc.vehicle else (doc.agent.get_full_name() or doc.agent.username)
        alerts.append({
            "document_id": doc.id,
            "holder": holder,
            "document_type": doc.document_type,
            "document_type_display": doc.get_document_type_display(),
            "document_number": doc.document_number,
            "expiry_date": doc.expiry_date,
            "days_remaining": days_remaining,
            "status": status,
        })
    return alerts


# FM-14 geofencing — restricted-zone entry only (see Geofence's docstring
# for why "unscheduled stops" isn't attempted). Checked against each
# active trip's latest known location, not a stored entry/exit event log —
# there's no background job/websocket in this build to raise the alert
# the instant it happens, so this is computed on read.
GEOFENCE_ALERT_MAX_AGE_MINUTES = 30


def geofence_alerts() -> list[dict]:
    """For every in-progress trip, whether its most recent location ping
    falls inside an active restricted geofence."""
    restricted_zones = list(Geofence.objects.filter(is_active=True, zone_type=Geofence.ZONE_RESTRICTED))
    if not restricted_zones:
        return []

    cutoff = timezone.now() - timezone.timedelta(minutes=GEOFENCE_ALERT_MAX_AGE_MINUTES)
    alerts = []
    for trip in Trip.objects.filter(status=Trip.STATUS_IN_PROGRESS).select_related("agent", "vehicle"):
        ping = (
            LocationPing.objects.filter(trip=trip, recorded_at__gte=cutoff).order_by("-recorded_at").first()
            or LocationPing.objects.filter(agent=trip.agent, recorded_at__gte=cutoff).order_by("-recorded_at").first()
        )
        if not ping:
            continue
        for zone in restricted_zones:
            distance_m = haversine_km(float(ping.latitude), float(ping.longitude), float(zone.latitude), float(zone.longitude)) * 1000
            if distance_m <= zone.radius_meters:
                alerts.append({
                    "trip_id": trip.id,
                    "agent_name": trip.agent.get_full_name() or trip.agent.username,
                    "vehicle_reg_no": trip.vehicle.reg_no if trip.vehicle else None,
                    "zone_id": zone.id,
                    "zone_name": zone.name,
                    "distance_meters": round(distance_m),
                    "recorded_at": ping.recorded_at,
                })
    return alerts
