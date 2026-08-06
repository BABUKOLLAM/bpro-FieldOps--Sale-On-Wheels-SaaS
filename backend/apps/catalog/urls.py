from rest_framework.routers import DefaultRouter

from .views import ItemCategoryViewSet, ItemViewSet, PriceListViewSet, SchemeViewSet, UOMViewSet

router = DefaultRouter()
router.register("uoms", UOMViewSet, basename="uom")
router.register("categories", ItemCategoryViewSet, basename="item-category")
router.register("items", ItemViewSet, basename="item")
router.register("price-lists", PriceListViewSet, basename="price-list")
router.register("schemes", SchemeViewSet, basename="scheme")

urlpatterns = router.urls
