from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Device, Role, User, UserRole


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    permission_codes = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone",
            "employee_code", "is_field_agent", "reporting_manager", "roles",
            "permission_codes", "is_active",
        ]

    def get_roles(self, obj):
        return list(obj.user_roles.values_list("role__name", flat=True))

    def get_permission_codes(self, obj):
        return sorted(obj.permission_codes())


class LoginSerializer(TokenObtainPairSerializer):
    """Extends the standard JWT login to also return the user's profile and
    permission codes, so the mobile app / admin-web don't need a second
    round trip after login to know what the user is allowed to do."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["tid"] = str(user.id)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = ["id", "user", "role", "scope_gst_registration"]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "name", "permissions", "is_active"]
        read_only_fields = ["name"]  # role identity is seeded; only permissions/is_active are editable


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            "id", "device_id", "platform", "push_token", "pin_set",
            "biometric_enabled", "is_active", "last_synced_at", "created_at",
        ]
        read_only_fields = ["last_synced_at", "created_at"]
