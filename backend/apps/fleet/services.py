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


# FM-08 idle-time / route-deviation analytics — best-effort from the same
# periodic (~3-minute interval) GPS breadcrumbs the live map uses, not
# continuous telemetry. "Idle" is inferred from consecutive pings that
# stayed within a small radius of each other, not a real ignition/motion
# sensor signal, and "deviation" is straight-line distance from the
# nearest planned stop, not road-network distance — both flagged here as
# what they are rather than oversold as precise.
IDLE_RADIUS_KM = 0.1
IDLE_ALERT_THRESHOLD_MINUTES = 15
ROUTE_DEVIATION_THRESHOLD_KM = 2.0


def trip_idle_minutes(trip: Trip) -> int:
    pings = list(LocationPing.objects.filter(trip=trip).order_by("recorded_at"))
    idle_seconds = 0.0
    for prev, curr in zip(pings, pings[1:]):
        dist_km = haversine_km(float(prev.latitude), float(prev.longitude), float(curr.latitude), float(curr.longitude))
        if dist_km <= IDLE_RADIUS_KM:
            idle_seconds += (curr.recorded_at - prev.recorded_at).total_seconds()
    return int(idle_seconds // 60)


def route_deviation_points(trip: Trip) -> list[dict]:
    """Pings further than ROUTE_DEVIATION_THRESHOLD_KM from every stop on
    the trip's beat. Returns [] if the trip has no beat, or no stop has a
    geocoded address — nothing to compare against, not "no deviation"."""
    if not trip.beat_id:
        return []

    from apps.customers.models import BeatCustomer, CustomerAddress

    stop_coords = []
    for bc in BeatCustomer.objects.filter(beat_id=trip.beat_id).select_related("customer"):
        addr = CustomerAddress.objects.filter(
            customer=bc.customer, latitude__isnull=False, longitude__isnull=False,
        ).first()
        if addr:
            stop_coords.append((float(addr.latitude), float(addr.longitude)))
    if not stop_coords:
        return []

    deviations = []
    for ping in LocationPing.objects.filter(trip=trip).order_by("recorded_at"):
        min_dist = min(
            haversine_km(float(ping.latitude), float(ping.longitude), lat, lng) for lat, lng in stop_coords
        )
        if min_dist > ROUTE_DEVIATION_THRESHOLD_KM:
            deviations.append({
                "recorded_at": ping.recorded_at,
                "latitude": ping.latitude,
                "longitude": ping.longitude,
                "distance_km": round(min_dist, 2),
            })
    return deviations


def trip_route_analytics(days: int = 30) -> list[dict]:
    """Per-trip idle time + deviation points for completed trips in the
    last `days` — only trips with something notable are returned, same
    "don't clutter the dashboard with every ok row" convention as
    maintenance_due_alerts/compliance_due_alerts."""
    since = timezone.now() - timezone.timedelta(days=days)
    trips = Trip.objects.filter(
        status=Trip.STATUS_COMPLETED, start_time__gte=since,
    ).select_related("agent", "vehicle", "beat")

    results = []
    for trip in trips:
        idle_minutes = trip_idle_minutes(trip)
        deviations = route_deviation_points(trip)
        if idle_minutes < IDLE_ALERT_THRESHOLD_MINUTES and not deviations:
            continue
        results.append({
            "trip_id": trip.id,
            "agent_name": trip.agent.get_full_name() or trip.agent.username,
            "vehicle_reg_no": trip.vehicle.reg_no if trip.vehicle else None,
            "beat_name": trip.beat.name if trip.beat else None,
            "start_time": trip.start_time,
            "idle_minutes": idle_minutes,
            "deviation_count": len(deviations),
        })
    return results


# FM-15 driver safety score — speeding + idling only, derived from the
# same GPS breadcrumbs as the analytics above. Harsh braking/acceleration
# would need an accelerometer stream this app doesn't collect, so it's
# not attempted here rather than faked with a plausible-looking number.
SPEED_LIMIT_KMPH = 80
SAFETY_SCORE_PER_SPEEDING_EVENT = 5
SAFETY_SCORE_PER_10PCT_IDLE = 5


def trip_speeding_events(trip: Trip) -> list[dict]:
    """Segments between consecutive pings implying an average speed over
    SPEED_LIMIT_KMPH — an average-speed-over-the-gap proxy from GPS
    breadcrumbs, not an instantaneous speedometer reading."""
    pings = list(LocationPing.objects.filter(trip=trip).order_by("recorded_at"))
    events = []
    for prev, curr in zip(pings, pings[1:]):
        seconds = (curr.recorded_at - prev.recorded_at).total_seconds()
        if seconds <= 0:
            continue
        dist_km = haversine_km(float(prev.latitude), float(prev.longitude), float(curr.latitude), float(curr.longitude))
        speed_kmph = dist_km / (seconds / 3600)
        if speed_kmph > SPEED_LIMIT_KMPH:
            events.append({"from": prev.recorded_at, "to": curr.recorded_at, "speed_kmph": round(speed_kmph, 1)})
    return events


def trip_safety_score(trip: Trip) -> dict | None:
    """100 = nothing flagged. Deducts for speeding events and for the
    idle-time share of total trip duration. Returns the raw signals
    alongside the score, not a bare number a supervisor can't
    interrogate. None if the trip has no start/end time to reason about."""
    if not trip.start_time or not trip.end_time:
        return None

    duration_minutes = (trip.end_time - trip.start_time).total_seconds() / 60
    if duration_minutes <= 0:
        return None

    speeding_events = trip_speeding_events(trip)
    idle_minutes = trip_idle_minutes(trip)
    idle_pct = min(idle_minutes / duration_minutes, 1.0) * 100

    score = 100
    score -= len(speeding_events) * SAFETY_SCORE_PER_SPEEDING_EVENT
    score -= (idle_pct // 10) * SAFETY_SCORE_PER_10PCT_IDLE
    score = max(0, min(100, int(score)))

    return {
        "trip_id": trip.id,
        "score": score,
        "speeding_event_count": len(speeding_events),
        "idle_minutes": idle_minutes,
        "idle_pct": round(idle_pct, 1),
    }


def driver_safety_scores(days: int = 30) -> list[dict]:
    """Average safety score per agent across their completed trips in the
    last `days`, worst first — a fleet manager's starting point for
    coaching, not an automated penalty."""
    since = timezone.now() - timezone.timedelta(days=days)
    trips = Trip.objects.filter(
        status=Trip.STATUS_COMPLETED, start_time__gte=since, end_time__isnull=False,
    ).select_related("agent")

    buckets: dict = {}
    for trip in trips:
        result = trip_safety_score(trip)
        if result is None:
            continue
        bucket = buckets.setdefault(trip.agent_id, {"agent": trip.agent, "scores": [], "speeding": 0, "idle": 0})
        bucket["scores"].append(result["score"])
        bucket["speeding"] += result["speeding_event_count"]
        bucket["idle"] += result["idle_minutes"]

    results = []
    for agent_id, bucket in buckets.items():
        agent = bucket["agent"]
        results.append({
            "agent_id": agent_id,
            "agent_name": agent.get_full_name() or agent.username,
            "trip_count": len(bucket["scores"]),
            "avg_score": round(sum(bucket["scores"]) / len(bucket["scores"]), 1),
            "total_speeding_events": bucket["speeding"],
            "total_idle_minutes": bucket["idle"],
        })
    results.sort(key=lambda r: r["avg_score"])
    return results
