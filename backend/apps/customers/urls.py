from rest_framework.routers import DefaultRouter

from .views import BeatViewSet, CustomerCategoryViewSet, CustomerViewSet

router = DefaultRouter()
router.register("categories", CustomerCategoryViewSet, basename="customer-category")
router.register("customers", CustomerViewSet, basename="customer")
router.register("beats", BeatViewSet, basename="beat")

urlpatterns = router.urls
