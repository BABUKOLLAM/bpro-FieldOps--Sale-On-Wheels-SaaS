from rest_framework import serializers


class ClientGeneratedIdMixin(serializers.Serializer):
    """Transactional records (Invoice, Receipt, CreditNote, Trip,
    TripCheckpoint, StockTransfer) are created offline on the mobile app
    with a client-generated UUID that doubles as the idempotency key for
    sync (see apps.mobile_sync and apps.integrations.SyncLogEntry). The
    model field has editable=False (it's never *changed* after creation),
    but it must still be *settable* on create — hence declaring it
    explicitly here rather than relying on ModelSerializer's default
    (which would mark it read_only)."""

    id = serializers.UUIDField(required=False)
