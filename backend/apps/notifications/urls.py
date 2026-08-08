from rest_framework.routers import DefaultRouter

from .views import DeviceTokenViewSet, NotificationLogViewSet

router = DefaultRouter()
router.register("device-tokens", DeviceTokenViewSet, basename="device-token")
router.register("logs", NotificationLogViewSet, basename="notification-log")

urlpatterns = router.urls
