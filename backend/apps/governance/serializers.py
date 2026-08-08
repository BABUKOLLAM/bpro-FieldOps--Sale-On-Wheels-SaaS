from rest_framework import serializers

from .models import ChangeRequest
from .services import slug_for_model


class ChangeRequestSerializer(serializers.ModelSerializer):
    target_type = serializers.SerializerMethodField()
    target_id = serializers.CharField(source="object_id", read_only=True)
    requested_by_username = serializers.CharField(source="requested_by.username", read_only=True)
    reviewed_by_username = serializers.CharField(source="reviewed_by.username", read_only=True, default=None)

    class Meta:
        model = ChangeRequest
        fields = [
            "id", "target_type", "target_id", "target_label", "proposed_changes", "previous_snapshot",
            "reason", "status", "requested_by", "requested_by_username", "requested_at",
            "reviewed_by", "reviewed_by_username", "reviewed_at", "review_note",
        ]
        read_only_fields = fields

    def get_target_type(self, obj):
        return slug_for_model(obj.content_type.model_class())


class ChangeRequestCreateSerializer(serializers.Serializer):
    target_type = serializers.CharField()
    target_id = serializers.CharField()
    proposed_changes = serializers.JSONField()
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class ChangeRequestReviewSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="")
