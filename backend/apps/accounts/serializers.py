from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Device, Role, SignupRequest, User, UserRole


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    role_assignments = serializers.SerializerMethodField()
    permission_codes = serializers.SerializerMethodField()
    deletable = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone",
            "employee_code", "is_field_agent", "reporting_manager", "roles",
            "role_assignments", "permission_codes", "is_active", "deletable", "password",
        ]

    def get_roles(self, obj):
        return list(obj.user_roles.values_list("role__name", flat=True))

    def get_role_assignments(self, obj):
        # {UserRole id, Role id, Role name} per assignment — the plain
        # "roles" field above is just names (kept as-is since the login
        # response and permission checks already depend on that exact
        # shape); this one exists so the admin-web Users page can target
        # a *specific* assignment to remove, since a user can hold more
        # than one role (accounts.UserRole has no one-role-per-user
        # constraint, only unique_together on (user, role)).
        return [
            {"id": str(ur.id), "role_id": str(ur.role_id), "role_name": ur.role.name}
            for ur in obj.user_roles.select_related("role").all()
        ]

    def get_permission_codes(self, obj):
        return sorted(obj.permission_codes())

    def get_deletable(self, obj):
        # A user can only be hard-deleted if nothing PROTECTs against it
        # (see the on_delete audit behind UserViewSet.destroy) — sales
        # orders/invoices/receipts/credit notes/trips/expenses/attendance
        # all block deletion at the DB level. Surfaced here so the UI can
        # show *why* delete isn't available instead of just failing.
        return not (
            obj.sales_orders.exists() or obj.invoices.exists() or obj.receipts.exists()
            or obj.credit_notes.exists() or obj.trips.exists() or obj.expenses.exists()
            or obj.attendance_records.exists()
        )

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
    """What an approving admin submits: no password — the account is
    created with an unusable one, and the new user sets their own via the
    one-time link SignupRequestViewSet.approve() emails them (see
    SetPasswordConfirmSerializer). Optionally the real Role to grant
    (independent of what was requested)."""

    username = serializers.CharField(required=False, allow_blank=True)
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all(), required=False, allow_null=True)


class SetPasswordConfirmSerializer(serializers.Serializer):
    """What the new user submits from the one-time set-password link
    (uid/token = Django's standard PasswordResetTokenGenerator pair, see
    SignupRequestViewSet.approve() for how they're issued)."""

    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})


class PasswordResetRequestSerializer(serializers.Serializer):
    """"Forgot password" entry point — accepts either their email or
    username, since either is a valid login identifier (a signup-approved
    account's username defaults to their email, but an admin can set it
    to something else — see SignupRequestApproveSerializer)."""

    email = serializers.CharField()


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            "id", "device_id", "platform", "push_token", "pin_set",
            "biometric_enabled", "is_active", "last_synced_at", "created_at",
        ]
        read_only_fields = ["last_synced_at", "created_at"]
