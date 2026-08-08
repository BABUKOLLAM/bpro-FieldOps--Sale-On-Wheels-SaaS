from rest_framework.routers import DefaultRouter

from .views import CompanyViewSet, GSTRegistrationViewSet

router = DefaultRouter()
router.register("companies", CompanyViewSet, basename="company")
router.register("gst-registrations", GSTRegistrationViewSet, basename="gst-registration")

urlpatterns = router.urls
