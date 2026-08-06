from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DashboardView, TargetViewSet

router = DefaultRouter()
router.register("targets", TargetViewSet, basename="target")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    *router.urls,
]
