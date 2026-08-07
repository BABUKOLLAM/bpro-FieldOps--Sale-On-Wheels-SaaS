from rest_framework.routers import DefaultRouter

from .views import BeatCustomerViewSet, BeatViewSet, CustomerCategoryViewSet, CustomerViewSet

router = DefaultRouter()
router.register("categories", CustomerCategoryViewSet, basename="customer-category")
router.register("customers", CustomerViewSet, basename="customer")
router.register("beats", BeatViewSet, basename="beat")
router.register("beat-stops", BeatCustomerViewSet, basename="beat-stop")

urlpatterns = router.urls
