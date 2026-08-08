from rest_framework.routers import DefaultRouter

from .views import (
    DeviceTokenViewSet, MessageTemplateViewSet, NotificationGatewaySettingsViewSet, NotificationLogViewSet,
)

router = DefaultRouter()
router.register("device-tokens", DeviceTokenViewSet, basename="device-token")
router.register("logs", NotificationLogViewSet, basename="notification-log")
router.register("gateway-settings", NotificationGatewaySettingsViewSet, basename="notification-gateway-settings")
router.register("message-templates", MessageTemplateViewSet, basename="message-template")

urlpatterns = router.urls
