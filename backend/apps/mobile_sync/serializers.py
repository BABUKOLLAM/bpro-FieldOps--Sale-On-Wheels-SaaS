from rest_framework import serializers

from apps.attendance.serializers import AttendanceSerializer
from apps.catalog.serializers import ItemSerializer, PriceListSerializer, SchemeSerializer
from apps.company.serializers import GSTRegistrationSerializer
from apps.customers.serializers import BeatSerializer, CustomerSerializer
from apps.expenses.serializers import ExpenseSerializer
from apps.fleet.serializers import LocationPingSerializer, TripCheckpointSerializer, TripSerializer
from apps.inventory.serializers import VanStockSerializer
from apps.sales.serializers import InvoiceSerializer


class CompanyConfigSerializer(serializers.Serializer):
    """Deliberately a narrow subset of apps.company.serializers.Company
    Serializer — just enough for the mobile app to build a UPI QR (§18)
    fully offline at point of sale, no logo/gst_registrations bulk."""

    legal_name = serializers.CharField()
    display_name = serializers.CharField()
    upi_vpa = serializers.CharField(allow_blank=True)


class PullResponseSerializer(serializers.Serializer):
    server_timestamp = serializers.DateTimeField()
    company = CompanyConfigSerializer()
    gst_registrations = GSTRegistrationSerializer(many=True)
    items = ItemSerializer(many=True)
    price_lists = PriceListSerializer(many=True)
    schemes = SchemeSerializer(many=True)
    customers = CustomerSerializer(many=True)
    beats = BeatSerializer(many=True)
    van_stock = VanStockSerializer(many=True)


class PushItemSerializer(serializers.Serializer):
    """One record in a push batch. `entity_type` selects which real
    serializer (Invoice, Trip, TripCheckpoint, Expense, ...) validates/
    creates `payload`. See mobile_sync.views.PUSH_HANDLERS for the
    supported set — Receipt/CreditNote/SalesOrder follow the identical
    pattern and are the natural next extension of this same list."""

    entity_type = serializers.ChoiceField(
        choices=["invoice", "trip", "trip_checkpoint", "expense", "location_ping", "attendance"]
    )
    payload = serializers.JSONField()


class PushRequestSerializer(serializers.Serializer):
    items = PushItemSerializer(many=True)


PUSH_HANDLERS = {
    "invoice": InvoiceSerializer,
    "trip": TripSerializer,
    "trip_checkpoint": TripCheckpointSerializer,
    "expense": ExpenseSerializer,
    "location_ping": LocationPingSerializer,
    "attendance": AttendanceSerializer,
}
