from rest_framework import serializers

from .models import Item, ItemCategory, PriceList, PriceListItem, Scheme, UOM


class UOMSerializer(serializers.ModelSerializer):
    class Meta:
        model = UOM
        fields = ["id", "code", "name"]


class ItemCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCategory
        fields = ["id", "name", "parent"]


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = [
            "id", "sku", "name", "barcode", "category", "base_uom", "hsn_code",
            "gst_rate", "is_active", "tally_guid", "updated_at",
        ]
        read_only_fields = ["tally_guid"]


class PriceListItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceListItem
        fields = ["id", "price_list", "item", "rate"]


class PriceListSerializer(serializers.ModelSerializer):
    items = PriceListItemSerializer(many=True, read_only=True)

    class Meta:
        model = PriceList
        fields = ["id", "name", "is_default", "is_active", "items"]


class SchemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scheme
        fields = [
            "id", "name", "item", "category", "discount_type", "value",
            "valid_from", "valid_to", "is_active",
        ]
