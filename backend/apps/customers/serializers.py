from rest_framework import serializers

from .models import Beat, BeatCustomer, Customer, CustomerAddress, CustomerCategory


class CustomerCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerCategory
        fields = ["id", "name"]


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = ["id", "customer", "label", "line1", "line2", "city", "state", "pincode", "latitude", "longitude"]


class CustomerSerializer(serializers.ModelSerializer):
    credit_status = serializers.SerializerMethodField()
    addresses = CustomerAddressSerializer(many=True, read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id", "code", "name", "gstin", "phone", "category", "credit_limit", "credit_days",
            "outstanding_balance", "is_blocked", "blocked_reason", "is_active", "tally_ledger_guid",
            "credit_status", "addresses", "updated_at",
        ]
        read_only_fields = ["outstanding_balance", "tally_ledger_guid"]

    def get_credit_status(self, obj):
        return obj.credit_status()


class BeatCustomerSerializer(serializers.ModelSerializer):
    customer_detail = CustomerSerializer(source="customer", read_only=True)

    class Meta:
        model = BeatCustomer
        fields = ["id", "beat", "customer", "customer_detail", "visit_sequence"]


class BeatSerializer(serializers.ModelSerializer):
    stops = BeatCustomerSerializer(many=True, read_only=True)

    class Meta:
        model = Beat
        fields = ["id", "name", "assigned_agent", "is_active", "stops"]
