from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Device, Role, SignupRequest, User, UserRole


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    permission_codes = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone",
            "employee_code", "is_field_agent", "reporting_manager", "roles",
            "permission_codes", "is_active", "password",
        ]

    def get_roles(self, obj):
        return list(obj.user_roles.values_list("role__name", flat=True))

    def get_permission_codes(self, obj):
        return sorted(obj.permission_codes())

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user


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
        # Entirely read-only: role identity is seeded, and permissions/
        # is_active now only change through apps.governance's ChangeRequest
        # workflow (RoleViewSet is a ReadOnlyModelViewSet).
        read_only_fields = fields


class SignupRequestSerializer(serializers.ModelSerializer):
    """Admin-facing read view — the approval queue list/detail."""

    requested_role_display = serializers.CharField(source="get_requested_role_name_display", read_only=True)
    decided_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SignupRequest
        fields = [
            "id", "name", "email", "phone", "requested_role_name", "requested_role_display",
            "department", "message", "status", "created_at", "decided_at", "decided_by_name",
        ]
        read_only_fields = fields

    def get_decided_by_name(self, obj):
        if not obj.decided_by:
            return None
        return obj.decided_by.get_full_name() or obj.decided_by.username


class SignupRequestCreateSerializer(serializers.ModelSerializer):
    """Public-facing write view — what the unauthenticated sign-up form
    submits. Deliberately excludes status/decision fields entirely (not
    just read-only) so a crafted request body can't self-approve."""

    class Meta:
        model = SignupRequest
        fields = ["id", "name", "email", "phone", "requested_role_name", "department", "message"]
        read_only_fields = ["id"]


class SignupRequestApproveSerializer(serializers.Serializer):
    """What an approving admin submits: the password they're assigning
    (communicated to the new user out-of-band — no email-link flow), and
    optionally the real Role to grant (independent of what was requested)."""

    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all(), required=False, allow_null=True)


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            "id", "device_id", "platform", "push_token", "pin_set",
            "biometric_enabled", "is_active", "last_synced_at", "created_at",
        ]
        read_only_fields = ["last_synced_at", "created_at"]
