from rest_framework.routers import DefaultRouter

from .views import ConnectorJobViewSet, ERPConnectionViewSet, SyncLogEntryViewSet

router = DefaultRouter()
router.register("erp-connections", ERPConnectionViewSet, basename="erp-connection")
router.register("sync-log", SyncLogEntryViewSet, basename="sync-log-entry")
router.register("connector/jobs", ConnectorJobViewSet, basename="connector-job")

urlpatterns = router.urls
