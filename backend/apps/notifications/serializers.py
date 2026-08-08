from rest_framework import serializers

from .models import DeviceToken, NotificationLog


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
