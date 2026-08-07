from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DashboardView, LiveMapView, ReportEmailView, ReportExportView, ReportListView, TargetViewSet

router = DefaultRouter()
router.register("targets", TargetViewSet, basename="target")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("live-map/", LiveMapView.as_view(), name="live-map"),
    path("reports/", ReportListView.as_view(), name="report-list"),
    path("export/<str:report_key>/", ReportExportView.as_view(), name="report-export"),
    path("export/<str:report_key>/email/", ReportEmailView.as_view(), name="report-email"),
    *router.urls,
]
