from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    FleetDashboardView, FuelLogViewSet, GeofenceViewSet, MaintenanceRecordViewSet, MaintenanceScheduleViewSet,
    TripCheckpointViewSet, TripViewSet, VehicleDocumentViewSet, VehicleViewSet,
)

router = DefaultRouter()
router.register("vehicles", VehicleViewSet, basename="vehicle")
router.register("trips", TripViewSet, basename="trip")
router.register("checkpoints", TripCheckpointViewSet, basename="trip-checkpoint")
router.register("fuel-logs", FuelLogViewSet, basename="fuel-log")
router.register("maintenance-schedules", MaintenanceScheduleViewSet, basename="maintenance-schedule")
router.register("maintenance-records", MaintenanceRecordViewSet, basename="maintenance-record")
router.register("documents", VehicleDocumentViewSet, basename="vehicle-document")
router.register("geofences", GeofenceViewSet, basename="geofence")

urlpatterns = [
    path("dashboard/", FleetDashboardView.as_view(), name="fleet-dashboard"),
    *router.urls,
]
