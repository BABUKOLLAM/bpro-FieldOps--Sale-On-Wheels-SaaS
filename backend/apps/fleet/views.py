from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.constants import PERM_FLEET_TRIP_MANAGE_OWN, PERM_FLEET_VEHICLE_MANAGE, PERM_FLEET_VIEW_ALL
from apps.accounts.permissions import HasRolePermission
from apps.inventory.models import StockTransfer

from .models import FuelLog, Geofence, MaintenanceRecord, MaintenanceSchedule, Trip, TripCheckpoint, Vehicle, VehicleDocument
from .serializers import (
    FuelLogSerializer, GeofenceSerializer, MaintenanceRecordSerializer, MaintenanceScheduleSerializer,
    TripCheckpointSerializer, TripSerializer, VehicleDocumentSerializer, VehicleSerializer,
)
from .services import (
    STATUS_OK, STATUS_OVERDUE, compliance_due_alerts, driver_safety_scores, end_trip, evaluate_fuel_log,
    geofence_alerts, maintenance_due_alerts, start_trip, trip_profitability, trip_route_analytics,
)


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


class VehicleDocumentViewSet(viewsets.ModelViewSet):
    queryset = VehicleDocument.objects.select_related("vehicle", "agent")
    serializer_class = VehicleDocumentSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_FLEET_VEHICLE_MANAGE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["vehicle", "agent", "document_type", "is_active"]


class GeofenceViewSet(viewsets.ModelViewSet):
    queryset = Geofence.objects.all().order_by("name")
    serializer_class = GeofenceSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_FLEET_VEHICLE_MANAGE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["zone_type", "is_active"]


class FleetDashboardView(APIView):
    """FM-12/FM-13: vehicle utilization, fuel cost, maintenance alerts,
    reverse-logistics reconciliation, document compliance (FM-16), and
    restricted-zone geofence alerts (FM-14) on one screen for a fleet
    manager."""

    permission_classes = [HasRolePermission]
    required_permission_code = PERM_FLEET_VIEW_ALL

    def get(self, request):
        today = timezone.localdate()
        cutoff_30d = timezone.now() - timedelta(days=30)
        cutoff_6mo = today.replace(day=1) - timedelta(days=180)

        all_alerts = maintenance_due_alerts()
        alerts_by_vehicle: dict = {}
        for alert in all_alerts:
            alerts_by_vehicle.setdefault(alert["vehicle_id"], []).append(alert)

        vehicles_data = []
        for vehicle in Vehicle.objects.filter(is_active=True).select_related("assigned_agent"):
            trips = list(Trip.objects.filter(vehicle=vehicle, start_time__gte=cutoff_30d))
            distance = sum((t.distance_travelled or Decimal("0")) for t in trips)

            fuel_agg = FuelLog.objects.filter(vehicle=vehicle, filled_at__gte=cutoff_30d).aggregate(
                cost=Sum("amount"), litres=Sum("fuel_qty_litres"),
            )
            fuel_cost = fuel_agg["cost"] or Decimal("0")
            fuel_litres = fuel_agg["litres"] or Decimal("0")
            efficiency = (distance / fuel_litres) if fuel_litres else None

            vehicle_alerts = alerts_by_vehicle.get(vehicle.id, [])
            worst_status = STATUS_OK
            for a in vehicle_alerts:
                worst_status = a["status"]
                if worst_status == STATUS_OVERDUE:
                    break

            agent = vehicle.assigned_agent
            vehicles_data.append({
                "vehicle_id": vehicle.id,
                "reg_no": vehicle.reg_no,
                "assigned_agent_name": (agent.get_full_name() or agent.username) if agent else None,
                "trip_count_30d": len(trips),
                "distance_km_30d": distance,
                "fuel_cost_30d": fuel_cost,
                "avg_efficiency_kmpl": efficiency,
                "maintenance_status": worst_status,
            })

        fuel_trend_qs = (
            FuelLog.objects.filter(filled_at__gte=cutoff_6mo)
            .annotate(month=TruncMonth("filled_at"))
            .values("month")
            .annotate(total_cost=Sum("amount"))
            .order_by("month")
        )
        fuel_cost_trend = [
            {"month": row["month"].strftime("%Y-%m"), "total_cost": row["total_cost"]} for row in fuel_trend_qs
        ]

        # Local import: apps.sales -> apps.fleet is a string-based FK only
        # (no import), so this direction is the only real dependency edge
        # between the two apps — kept local to make that edge easy to spot.
        from apps.sales.models import CreditNote, CreditNoteLine

        damaged_lines = (
            CreditNoteLine.objects.filter(
                condition__in=[CreditNote.CONDITION_DAMAGED, CreditNote.CONDITION_EXPIRED],
                credit_note__note_date__gte=today - timedelta(days=30),
            )
            .select_related("credit_note", "credit_note__agent", "item")
        )
        reverse_logistics = []
        for line in damaged_lines:
            note = line.credit_note
            reconciled = StockTransfer.objects.filter(
                transfer_type=StockTransfer.TYPE_VAN_UNLOAD, agent=note.agent,
                transfer_date=note.note_date, status=StockTransfer.STATUS_COMPLETED,
            ).exists()
            reverse_logistics.append({
                "credit_note_id": note.id,
                "credit_note_no": note.credit_note_no,
                "agent_name": note.agent.get_full_name() or note.agent.username,
                "item_name": line.item.name,
                "qty": line.qty,
                "condition": line.condition,
                "date": note.note_date,
                "reconciled": reconciled,
            })

        return Response({
            "vehicles": vehicles_data,
            "maintenance_alerts": all_alerts,
            "fuel_cost_trend": fuel_cost_trend,
            "reverse_logistics": reverse_logistics,
            "compliance_alerts": compliance_due_alerts(),
            "geofence_alerts": geofence_alerts(),
            "route_analytics": trip_route_analytics(),
            "driver_safety_scores": driver_safety_scores(),
            "trip_profitability": trip_profitability(),
        })
