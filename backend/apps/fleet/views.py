from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.constants import PERM_FLEET_TRIP_MANAGE_OWN, PERM_FLEET_VEHICLE_MANAGE, PERM_FLEET_VIEW_ALL
from apps.accounts.permissions import HasRolePermission

from .models import FuelLog, MaintenanceRecord, MaintenanceSchedule, Trip, TripCheckpoint, Vehicle
from .serializers import (
    FuelLogSerializer, MaintenanceRecordSerializer, MaintenanceScheduleSerializer,
    TripCheckpointSerializer, TripSerializer, VehicleSerializer,
)
from .services import end_trip, evaluate_fuel_log, start_trip


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all().order_by("reg_no")
    serializer_class = VehicleSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_FLEET_VEHICLE_MANAGE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["is_active", "assigned_agent"]


def _can_view_all(user):
    codes = user.permission_codes()
    return user.is_superuser or PERM_FLEET_VIEW_ALL in codes or PERM_FLEET_VEHICLE_MANAGE in codes


class TripViewSet(viewsets.ModelViewSet):
    """Trip Start/End & Check-in/Check-out (FR-08, FM-01). A field agent
    manages only their own trips; supervisors/fleet managers see all."""

    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "agent", "vehicle"]

    def get_queryset(self):
        qs = Trip.objects.select_related("vehicle", "agent").prefetch_related("checkpoints")
        if _can_view_all(self.request.user):
            return qs
        return qs.filter(agent=self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_superuser or PERM_FLEET_TRIP_MANAGE_OWN in user.permission_codes() or _can_view_all(user)):
            raise PermissionDenied("Not allowed to create trips.")
        serializer.save(agent=serializer.validated_data.get("agent") or user)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        trip = self.get_object()
        trip = start_trip(
            trip,
            odometer=request.data.get("odometer"),
            latitude=request.data.get("latitude"),
            longitude=request.data.get("longitude"),
        )
        return Response(self.get_serializer(trip).data)

    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        trip = self.get_object()
        trip = end_trip(
            trip,
            odometer=request.data.get("odometer"),
            latitude=request.data.get("latitude"),
            longitude=request.data.get("longitude"),
        )
        return Response(self.get_serializer(trip).data)


class TripCheckpointViewSet(viewsets.ModelViewSet):
    serializer_class = TripCheckpointSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["trip", "customer"]

    def get_queryset(self):
        qs = TripCheckpoint.objects.select_related("trip", "customer")
        if _can_view_all(self.request.user):
            return qs
        return qs.filter(trip__agent=self.request.user)

    @action(detail=True, methods=["post"])
    def check_in(self, request, pk=None):
        checkpoint = self.get_object()
        checkpoint.check_in_time = timezone.now()
        checkpoint.check_in_latitude = request.data.get("latitude")
        checkpoint.check_in_longitude = request.data.get("longitude")
        checkpoint.save(update_fields=["check_in_time", "check_in_latitude", "check_in_longitude"])
        return Response(self.get_serializer(checkpoint).data)

    @action(detail=True, methods=["post"])
    def check_out(self, request, pk=None):
        checkpoint = self.get_object()
        checkpoint.check_out_time = timezone.now()
        checkpoint.check_out_latitude = request.data.get("latitude")
        checkpoint.check_out_longitude = request.data.get("longitude")
        checkpoint.save(update_fields=["check_out_time", "check_out_latitude", "check_out_longitude"])
        return Response(self.get_serializer(checkpoint).data)


class FuelLogViewSet(viewsets.ModelViewSet):
    serializer_class = FuelLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["vehicle", "flagged_for_review"]

    def get_queryset(self):
        qs = FuelLog.objects.select_related("vehicle", "trip")
        if _can_view_all(self.request.user):
            return qs
        return qs.filter(trip__agent=self.request.user)

    def perform_create(self, serializer):
        fuel_log = serializer.save()
        evaluate_fuel_log(fuel_log)


class MaintenanceScheduleViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceSchedule.objects.all()
    serializer_class = MaintenanceScheduleSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_FLEET_VEHICLE_MANAGE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["vehicle", "is_active"]


class MaintenanceRecordViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRecord.objects.all()
    serializer_class = MaintenanceRecordSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_FLEET_VEHICLE_MANAGE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["vehicle"]
