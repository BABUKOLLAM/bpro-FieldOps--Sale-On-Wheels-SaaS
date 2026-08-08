from rest_framework import serializers

from .models import Item, ItemCategory, PriceList, PriceListItem, Scheme, SchemeBXGY, SchemeSlab, UOM


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


class SchemeSlabSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchemeSlab
        fields = ["id", "scheme", "min_qty", "max_qty", "discount_type", "value"]
        extra_kwargs = {"scheme": {"required": False}}


class SchemeSerializer(serializers.ModelSerializer):
    slabs = SchemeSlabSerializer(many=True, required=False)

    class Meta:
        model = Scheme
        fields = [
            "id", "name", "item", "category", "discount_type", "value",
            "valid_from", "valid_to", "is_active", "slabs",
        ]

    def create(self, validated_data):
        slabs_data = validated_data.pop("slabs", [])
        scheme = Scheme.objects.create(**validated_data)
        for slab in slabs_data:
            SchemeSlab.objects.create(scheme=scheme, **slab)
        return scheme

    def update(self, instance, validated_data):
        slabs_data = validated_data.pop("slabs", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if slabs_data is not None:
            instance.slabs.all().delete()
            for slab in slabs_data:
                SchemeSlab.objects.create(scheme=instance, **slab)
        return instance


class SchemeBXGYSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchemeBXGY
        fields = [
            "id", "name", "trigger_item", "trigger_qty", "bonus_item", "bonus_qty",
            "max_multiples", "valid_from", "valid_to", "is_active",
        ]
