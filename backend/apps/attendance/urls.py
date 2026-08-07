from rest_framework.routers import DefaultRouter

from .views import AttendanceViewSet

router = DefaultRouter()
router.register("", AttendanceViewSet, basename="attendance")

urlpatterns = router.urls
