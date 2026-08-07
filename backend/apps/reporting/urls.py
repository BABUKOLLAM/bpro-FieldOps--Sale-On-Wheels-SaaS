from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DashboardView, LiveMapView, TargetViewSet

router = DefaultRouter()
router.register("targets", TargetViewSet, basename="target")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("live-map/", LiveMapView.as_view(), name="live-map"),
    *router.urls,
]
