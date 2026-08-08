from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PaymentGatewayConnectionViewSet, PaymentOrderViewSet, PaymentWebhookView

router = DefaultRouter()
router.register("orders", PaymentOrderViewSet, basename="payment-order")
router.register("gateway-connections", PaymentGatewayConnectionViewSet, basename="payment-gateway-connection")

urlpatterns = [
    path("webhook/", PaymentWebhookView.as_view(), name="payment-webhook"),
] + router.urls
