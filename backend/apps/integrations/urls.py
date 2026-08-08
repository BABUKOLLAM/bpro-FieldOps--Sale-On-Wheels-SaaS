from rest_framework.routers import DefaultRouter

from .views import (
    ConnectorJobViewSet, ERPConnectionViewSet, SyncLogEntryViewSet, WebhookDeliveryLogViewSet, WebhookViewSet,
)

router = DefaultRouter()
router.register("erp-connections", ERPConnectionViewSet, basename="erp-connection")
router.register("sync-log", SyncLogEntryViewSet, basename="sync-log-entry")
router.register("connector/jobs", ConnectorJobViewSet, basename="connector-job")
router.register("webhooks", WebhookViewSet, basename="webhook")
router.register("webhook-deliveries", WebhookDeliveryLogViewSet, basename="webhook-delivery")

urlpatterns = router.urls
