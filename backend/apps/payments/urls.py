from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PaymentOrderViewSet, PaymentWebhookView

router = DefaultRouter()
router.register("orders", PaymentOrderViewSet, basename="payment-order")

urlpatterns = [
    path("webhook/", PaymentWebhookView.as_view(), name="payment-webhook"),
] + router.urls
