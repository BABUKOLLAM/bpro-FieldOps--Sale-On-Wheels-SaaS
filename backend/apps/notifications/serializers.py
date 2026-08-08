from rest_framework import serializers

from .models import DeviceToken, MessageTemplate, NotificationGatewaySettings, NotificationLog


class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ["id", "user", "token", "platform", "provider", "is_active", "created_at"]
        read_only_fields = ["user"]
        # DRF auto-adds a UniqueValidator for `token` since the field is
        # unique=True; that would 400 a re-registered token before
        # perform_create's own update_or_create upsert ever runs.
        extra_kwargs = {"token": {"validators": []}}


class NotificationLogSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True, default="")

    class Meta:
        model = NotificationLog
        fields = ["id", "user", "user_username", "title", "body", "data", "channel", "device_count", "created_at"]


class NotificationGatewaySettingsSerializer(serializers.ModelSerializer):
    # The actual keys are never serialized — only whether one is
    # configured, same masked-secret posture as everywhere else
    # credentials show up in this codebase (ERPConnection, Webhook).
    has_fcm_server_key = serializers.SerializerMethodField()
    has_sms_gateway_api_key = serializers.SerializerMethodField()

    class Meta:
        model = NotificationGatewaySettings
        fields = ["id", "sms_gateway_url", "has_fcm_server_key", "has_sms_gateway_api_key"]
        read_only_fields = fields  # edits go through apps.governance — see apps/notifications/governance.py

    def get_has_fcm_server_key(self, obj):
        return bool(obj.fcm_server_key)

    def get_has_sms_gateway_api_key(self, obj):
        return bool(obj.sms_gateway_api_key)


class MessageTemplateSerializer(serializers.ModelSerializer):
    key_display = serializers.CharField(source="get_key_display", read_only=True)

    class Meta:
        model = MessageTemplate
        fields = ["id", "key", "key_display", "title_template", "body_template"]
        read_only_fields = fields  # edits go through apps.governance — see apps/notifications/governance.py
