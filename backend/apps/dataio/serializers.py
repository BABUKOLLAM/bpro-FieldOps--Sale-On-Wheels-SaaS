from rest_framework import serializers

from .models import ImportJob


class ImportJobSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.username", read_only=True, default="")

    class Meta:
        model = ImportJob
        fields = [
            "id", "entity_slug", "file_name", "uploaded_by_name",
            "created_count", "updated_count", "error_count", "errors", "created_at",
        ]
