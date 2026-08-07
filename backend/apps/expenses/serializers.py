from rest_framework import serializers

from apps.core.serializers import ClientGeneratedIdMixin

from .models import Expense


class ExpenseSerializer(ClientGeneratedIdMixin, serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = [
            "id", "agent", "trip", "category", "amount", "description", "receipt_photo",
            "expense_date", "status", "approved_by", "approved_at", "rejection_reason",
            "device_created_at",
        ]
        read_only_fields = ["status", "approved_by", "approved_at", "rejection_reason"]
        extra_kwargs = {"agent": {"required": False}}
