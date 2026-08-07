from rest_framework import serializers

from apps.core.serializers import ClientGeneratedIdMixin

from .models import Attendance


class AttendanceSerializer(ClientGeneratedIdMixin, serializers.ModelSerializer):
    duration_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            "id", "agent", "check_in_at", "check_in_latitude", "check_in_longitude", "check_in_selfie",
            "check_out_at", "check_out_latitude", "check_out_longitude", "check_out_selfie",
            "device_created_at", "duration_minutes",
        ]
        read_only_fields = ["check_out_at", "check_out_latitude", "check_out_longitude", "check_out_selfie"]
        extra_kwargs = {"agent": {"required": False}}

    def get_duration_minutes(self, obj):
        return obj.duration_minutes()
