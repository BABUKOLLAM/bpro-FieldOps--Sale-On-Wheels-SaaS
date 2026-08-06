from rest_framework import serializers

from .models import Godown, StockLedgerEntry, StockTransfer, StockTransferLine, VanStock


class GodownSerializer(serializers.ModelSerializer):
    class Meta:
        model = Godown
        fields = ["id", "name", "godown_type", "assigned_agent", "is_active", "tally_godown_guid"]
        read_only_fields = ["tally_godown_guid"]


class VanStockSerializer(serializers.ModelSerializer):
    item_sku = serializers.CharField(source="item.sku", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = VanStock
        fields = ["id", "godown", "item", "item_sku", "item_name", "qty_on_hand"]


class StockLedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = StockLedgerEntry
        fields = [
            "id", "godown", "item", "txn_type", "qty", "balance_after",
            "reference_type", "reference_id", "created_at",
        ]
        read_only_fields = fields


class StockTransferLineSerializer(serializers.ModelSerializer):
    variance_qty = serializers.SerializerMethodField()

    class Meta:
        model = StockTransferLine
        fields = ["id", "transfer", "item", "expected_qty", "actual_qty", "variance_reason", "variance_qty"]

    def get_variance_qty(self, obj):
        return obj.variance_qty


class StockTransferSerializer(serializers.ModelSerializer):
    lines = StockTransferLineSerializer(many=True, required=False)

    class Meta:
        model = StockTransfer
        fields = [
            "id", "transfer_type", "from_godown", "to_godown", "agent", "trip",
            "status", "transfer_date", "completed_at", "lines",
        ]
        read_only_fields = ["status", "completed_at"]

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        transfer = StockTransfer.objects.create(**validated_data)
        for line in lines_data:
            StockTransferLine.objects.create(transfer=transfer, **line)
        return transfer
