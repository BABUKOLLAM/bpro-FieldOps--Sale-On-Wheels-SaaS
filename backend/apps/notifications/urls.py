from rest_framework.routers import DefaultRouter

from .views import DeviceTokenViewSet, NotificationGatewaySettingsViewSet, NotificationLogViewSet

router = DefaultRouter()
router.register("device-tokens", DeviceTokenViewSet, basename="device-token")
router.register("logs", NotificationLogViewSet, basename="notification-log")
router.register("gateway-settings", NotificationGatewaySettingsViewSet, basename="notification-gateway-settings")

urlpatterns = router.urls
