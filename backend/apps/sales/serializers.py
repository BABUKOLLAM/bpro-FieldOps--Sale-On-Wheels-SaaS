from django.utils import timezone
from rest_framework import serializers

from apps.core.serializers import ClientGeneratedIdMixin

from .models import (
    CreditNote, CreditNoteLine, EwayBill, EwayBillSettings, Invoice, InvoiceLine, PaymentAllocation,
    Receipt, SalesOrder, SalesOrderLine,
)


class SalesOrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesOrderLine
        fields = ["id", "order", "item", "qty", "rate"]
        extra_kwargs = {"order": {"required": False}}


class SalesOrderSerializer(ClientGeneratedIdMixin, serializers.ModelSerializer):
    lines = SalesOrderLineSerializer(many=True)

    class Meta:
        model = SalesOrder
        fields = ["id", "order_no", "customer", "agent", "trip", "order_date", "status", "notes", "lines"]
        read_only_fields = ["order_no", "status"]

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        order = SalesOrder.objects.create(**validated_data)
        for line in lines_data:
            SalesOrderLine.objects.create(order=order, **line)
        return order


class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLine
        fields = [
            "id", "invoice", "item", "qty", "rate", "discount_amount", "taxable_amount",
            "cgst_amount", "sgst_amount", "igst_amount", "line_total", "is_bonus", "bxgy_scheme",
        ]
        read_only_fields = [
            "taxable_amount", "cgst_amount", "sgst_amount", "igst_amount", "line_total",
            "is_bonus", "bxgy_scheme",
        ]
        extra_kwargs = {"invoice": {"required": False}}


class InvoiceSerializer(ClientGeneratedIdMixin, serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True)

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_no", "source", "sales_order", "customer", "agent", "trip", "godown",
            "gst_registration", "place_of_supply_state", "invoice_date", "subtotal", "discount_total",
            "tax_total", "grand_total", "payment_status", "credit_check_status", "credit_override_reason",
            "sync_status", "signature_image", "device_created_at", "lines",
            "delivery_confirmed_via", "delivery_confirmed_at",
        ]
        read_only_fields = [
            "invoice_no", "subtotal", "discount_total", "tax_total", "grand_total",
            "payment_status", "credit_check_status", "sync_status",
            "delivery_confirmed_via", "delivery_confirmed_at",
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        invoice = Invoice.objects.create(**validated_data)
        for line in lines_data:
            InvoiceLine.objects.create(invoice=invoice, **line)

        override_by = self.context.get("credit_override_by")
        override_reason = self.context.get("credit_override_reason", "")
        from .services import finalize_invoice

        finalize_invoice(invoice, override_by=override_by, override_reason=override_reason)
        return invoice

    def update(self, instance, validated_data):
        # A signature-only PATCH (the mobile app's proof-of-delivery
        # capture flow) is the one update path that also stamps delivery
        # confirmation — every other field update behaves exactly like
        # ModelSerializer's default (touches only keys present).
        signature_provided = "signature_image" in validated_data
        instance = super().update(instance, validated_data)
        if signature_provided and instance.signature_image:
            instance.delivery_confirmed_via = Invoice.DELIVERY_VIA_SIGNATURE
            instance.delivery_confirmed_at = timezone.now()
            instance.save(update_fields=["delivery_confirmed_via", "delivery_confirmed_at"])
        return instance


class PaymentAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentAllocation
        fields = ["id", "receipt", "invoice", "amount"]
        extra_kwargs = {"receipt": {"required": False}}


class ReceiptSerializer(ClientGeneratedIdMixin, serializers.ModelSerializer):
    allocations = PaymentAllocationSerializer(many=True)

    class Meta:
        model = Receipt
        fields = [
            "id", "receipt_no", "customer", "agent", "trip", "mode", "amount",
            "reference_no", "received_at", "sync_status", "allocations",
        ]
        read_only_fields = ["receipt_no", "sync_status"]

    def create(self, validated_data):
        allocations_data = validated_data.pop("allocations")
        receipt = Receipt.objects.create(**validated_data)
        for allocation in allocations_data:
            PaymentAllocation.objects.create(receipt=receipt, **allocation)

        from .services import finalize_receipt

        finalize_receipt(receipt)
        return receipt


class CreditNoteLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditNoteLine
        fields = ["id", "credit_note", "original_invoice_line", "item", "qty", "rate", "condition", "line_total"]
        read_only_fields = ["line_total"]
        extra_kwargs = {"credit_note": {"required": False}}


class CreditNoteSerializer(ClientGeneratedIdMixin, serializers.ModelSerializer):
    lines = CreditNoteLineSerializer(many=True)

    class Meta:
        model = CreditNote
        fields = [
            "id", "credit_note_no", "original_invoice", "customer", "agent", "trip",
            "reason_code", "note_date", "grand_total", "sync_status", "lines",
        ]
        read_only_fields = ["credit_note_no", "grand_total", "sync_status"]

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        credit_note = CreditNote.objects.create(**validated_data)
        for line in lines_data:
            CreditNoteLine.objects.create(credit_note=credit_note, **line)

        from .services import finalize_credit_note

        finalize_credit_note(credit_note)
        return credit_note


class EwayBillSerializer(serializers.ModelSerializer):
    class Meta:
        model = EwayBill
        fields = [
            "id", "invoice", "status", "transport_mode", "vehicle_no", "transporter_id",
            "transporter_name", "distance_km", "payload", "ewb_number", "valid_until", "created_at",
        ]
        read_only_fields = ["invoice", "status", "payload", "ewb_number", "valid_until", "created_at"]


class EwayBillGenerateSerializer(serializers.Serializer):
    transport_mode = serializers.ChoiceField(choices=EwayBill.MODE_CHOICES, default=EwayBill.MODE_ROAD)
    vehicle_no = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    transporter_id = serializers.CharField(max_length=15, required=False, allow_blank=True, default="")
    transporter_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    distance_km = serializers.IntegerField(min_value=0, default=0)


class EwayBillSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = EwayBillSettings
        fields = ["id", "threshold_amount", "is_active"]
        read_only_fields = fields
