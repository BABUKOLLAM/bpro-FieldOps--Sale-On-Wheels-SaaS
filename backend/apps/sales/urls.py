from rest_framework.routers import DefaultRouter

from .views import (
    CreditNoteViewSet, EwayBillSettingsViewSet, InvoiceViewSet, ReceiptViewSet, SalesOrderViewSet,
)

router = DefaultRouter()
router.register("orders", SalesOrderViewSet, basename="sales-order")
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("receipts", ReceiptViewSet, basename="receipt")
router.register("credit-notes", CreditNoteViewSet, basename="credit-note")
router.register("eway-bill-settings", EwayBillSettingsViewSet, basename="eway-bill-settings")

urlpatterns = router.urls
