from rest_framework import serializers

from .models import ERPConnection, SyncLogEntry


class ERPConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ERPConnection
        fields = ["id", "erp_type", "sync_mode", "batch_interval_minutes", "is_active"]


class SyncLogEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncLogEntry
        fields = [
            "id", "entity_type", "local_object_id", "erp_reference_id", "status",
            "retry_count", "next_retry_at", "error_message", "created_at", "updated_at",
        ]
        read_only_fields = fields


class ConnectorJobSerializer(serializers.ModelSerializer):
    """What the on-prem connector agent sees when polling for pending
    jobs — includes the built request payload it needs to post to Tally."""

    class Meta:
        model = SyncLogEntry
        fields = ["id", "entity_type", "local_object_id", "request_payload", "retry_count"]
        read_only_fields = fields


class ConnectorJobResultSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["acknowledged", "failed"])
    erp_reference_id = serializers.CharField(required=False, allow_blank=True)
    error_message = serializers.CharField(required=False, allow_blank=True)
    response_payload = serializers.JSONField(required=False)
