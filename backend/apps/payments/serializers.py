from rest_framework import serializers

from .models import PaymentGatewayConnection, PaymentOrder


class PaymentGatewayConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentGatewayConnection
        # credentials are deliberately never exposed here — same posture
        # as apps.integrations.ERPConnectionSerializer; set/rotated via
        # Django admin/shell only.
        fields = ["id", "gateway_type", "is_active"]
        read_only_fields = fields  # edits go through apps.governance — see apps/payments/governance.py


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
