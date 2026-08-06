from rest_framework.routers import DefaultRouter

from .views import (
    FuelLogViewSet, MaintenanceRecordViewSet, MaintenanceScheduleViewSet,
    TripCheckpointViewSet, TripViewSet, VehicleViewSet,
)

router = DefaultRouter()
router.register("vehicles", VehicleViewSet, basename="vehicle")
router.register("trips", TripViewSet, basename="trip")
router.register("checkpoints", TripCheckpointViewSet, basename="trip-checkpoint")
router.register("fuel-logs", FuelLogViewSet, basename="fuel-log")
router.register("maintenance-schedules", MaintenanceScheduleViewSet, basename="maintenance-schedule")
router.register("maintenance-records", MaintenanceRecordViewSet, basename="maintenance-record")

urlpatterns = router.urls
