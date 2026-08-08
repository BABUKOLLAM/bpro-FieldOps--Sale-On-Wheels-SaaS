from django.contrib import admin

from .models import PaymentGatewayConnection, PaymentOrder


@admin.register(PaymentGatewayConnection)
class PaymentGatewayConnectionAdmin(admin.ModelAdmin):
    list_display = ("gateway_type", "is_active")


@admin.register(PaymentOrder)
class PaymentOrderAdmin(admin.ModelAdmin):
    list_display = ("invoice", "gateway_type", "gateway_order_id", "amount", "status", "created_at")
    list_filter = ("gateway_type", "status")
    search_fields = ("gateway_order_id", "invoice__invoice_no")
