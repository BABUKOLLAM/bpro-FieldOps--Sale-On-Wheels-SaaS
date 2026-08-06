from rest_framework.routers import DefaultRouter

from .views import GodownViewSet, StockLedgerEntryViewSet, StockTransferViewSet, VanStockViewSet

router = DefaultRouter()
router.register("godowns", GodownViewSet, basename="godown")
router.register("van-stock", VanStockViewSet, basename="van-stock")
router.register("ledger", StockLedgerEntryViewSet, basename="stock-ledger-entry")
router.register("transfers", StockTransferViewSet, basename="stock-transfer")

urlpatterns = router.urls
