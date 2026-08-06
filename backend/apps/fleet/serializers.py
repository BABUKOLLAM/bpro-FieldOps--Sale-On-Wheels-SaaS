from rest_framework import serializers

from apps.core.serializers import ClientGeneratedIdMixin

from .models import (
    FuelLog, MaintenanceRecord, MaintenanceSchedule, OdometerLog, Trip, TripCheckpoint, Vehicle,
)


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ["id", "reg_no", "vehicle_type", "assigned_agent", "fuel_type", "is_active"]


class TripCheckpointSerializer(ClientGeneratedIdMixin, serializers.ModelSerializer):
    visit_duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = TripCheckpoint
        fields = [
            "id", "trip", "customer", "check_in_time", "check_out_time",
            "check_in_latitude", "check_in_longitude", "check_out_latitude", "check_out_longitude",
            "notes", "visit_duration_seconds",
        ]

    def get_visit_duration_seconds(self, obj):
        return obj.visit_duration_seconds


class TripSerializer(ClientGeneratedIdMixin, serializers.ModelSerializer):
    """
    status/start_time/end_time/odometer are writable here — not just via
    the start/end actions below — because a field agent's mobile app
    records the actual start/end event *offline*, then pushes the
    already-complete trip through apps.mobile_sync's generic push
    endpoint (see mobile/src/sync/synchronize.ts), not through a live
    API call at the moment the agent taps "Start Trip". The start/end
    actions remain for a supervisor/admin-web driven "trip control" use
    case, but the mobile client's real, offline-first flow goes through
    plain create()/update() on this serializer.
    """

    checkpoints = TripCheckpointSerializer(many=True, read_only=True)
    distance_travelled = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            "id", "vehicle", "agent", "beat", "status", "start_time", "end_time",
            "start_odometer", "end_odometer", "start_latitude", "start_longitude",
            "end_latitude", "end_longitude", "checkpoints", "distance_travelled",
        ]

    def get_distance_travelled(self, obj):
        return obj.distance_travelled


class OdometerLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = OdometerLog
        fields = ["id", "vehicle", "trip", "reading_type", "reading", "photo", "recorded_at"]
        read_only_fields = ["recorded_at"]


class FuelLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelLog
        fields = [
            "id", "vehicle", "trip", "fuel_qty_litres", "amount", "odometer_reading",
            "station", "filled_at", "flagged_for_review", "flag_reason",
        ]
        read_only_fields = ["flagged_for_review", "flag_reason"]


class MaintenanceScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceSchedule
        fields = [
            "id", "vehicle", "description", "interval_km", "interval_days",
            "next_due_odometer", "next_due_date", "is_active",
        ]


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceRecord
        fields = ["id", "vehicle", "schedule", "service_date", "odometer_reading", "cost", "description"]
