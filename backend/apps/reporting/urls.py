from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AnomalyInsightsView, DashboardView, ExceptionAlertsView, FraudAlertsView, LiveMapView, ReportEmailView,
    ReportExportView, ReportListView, TargetViewSet,
)

router = DefaultRouter()
router.register("targets", TargetViewSet, basename="target")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("alerts/", ExceptionAlertsView.as_view(), name="exception-alerts"),
    path("anomaly-insights/", AnomalyInsightsView.as_view(), name="anomaly-insights"),
    path("fraud-alerts/", FraudAlertsView.as_view(), name="fraud-alerts"),
    path("live-map/", LiveMapView.as_view(), name="live-map"),
    path("reports/", ReportListView.as_view(), name="report-list"),
    path("export/<str:report_key>/", ReportExportView.as_view(), name="report-export"),
    path("export/<str:report_key>/email/", ReportEmailView.as_view(), name="report-email"),
    *router.urls,
]
