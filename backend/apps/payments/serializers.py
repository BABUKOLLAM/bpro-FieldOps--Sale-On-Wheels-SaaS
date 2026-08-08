from rest_framework import serializers

from .models import PaymentOrder


class PaymentOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentOrder
        fields = [
            "id", "invoice", "gateway_type", "gateway_order_id", "amount", "currency",
            "status", "receipt", "created_at",
        ]
        read_only_fields = ["gateway_type", "gateway_order_id", "status", "receipt", "created_at"]


class CreatePaymentOrderSerializer(serializers.Serializer):
    invoice = serializers.UUIDField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
