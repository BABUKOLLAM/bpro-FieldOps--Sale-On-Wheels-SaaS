from rest_framework.routers import DefaultRouter

from .views import (
    BeatCustomerViewSet, BeatTemplateStopViewSet, BeatTemplateViewSet, BeatViewSet, CustomerCategoryViewSet,
    CustomerViewSet,
)

router = DefaultRouter()
router.register("categories", CustomerCategoryViewSet, basename="customer-category")
router.register("customers", CustomerViewSet, basename="customer")
router.register("beats", BeatViewSet, basename="beat")
router.register("beat-stops", BeatCustomerViewSet, basename="beat-stop")
router.register("beat-templates", BeatTemplateViewSet, basename="beat-template")
router.register("beat-template-stops", BeatTemplateStopViewSet, basename="beat-template-stop")

urlpatterns = router.urls
