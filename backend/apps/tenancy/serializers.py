from rest_framework import serializers

from .models import PlatformAdmin, Tenant


class PlatformAdminLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        try:
            admin = PlatformAdmin.objects.get(email__iexact=attrs["email"], is_active=True)
        except PlatformAdmin.DoesNotExist:
            raise serializers.ValidationError("Invalid credentials.")
        if not admin.check_password(attrs["password"]):
            raise serializers.ValidationError("Invalid credentials.")
        attrs["admin"] = admin
        return attrs


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ["id", "slug", "name", "is_active", "created_at"]
        read_only_fields = fields


class ProvisionTenantSerializer(serializers.Serializer):
    slug = serializers.SlugField(max_length=63)
    name = serializers.CharField(max_length=200)
