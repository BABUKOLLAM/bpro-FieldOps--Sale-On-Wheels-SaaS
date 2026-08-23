from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import Q
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts.constants import PERM_ROLES_MANAGE, PERM_USERS_MANAGE

from .models import Device, Role, SignupRequest, User, UserRole
from .notifications import (
    send_password_reset_link, send_signup_request_approved, send_signup_request_rejected,
    send_signup_request_submitted,
)
from .permissions import HasRolePermission
from .serializers import (
    DeviceSerializer, LoginSerializer, PasswordResetRequestSerializer, RoleSerializer,
    SetPasswordConfirmSerializer, SignupRequestApproveSerializer, SignupRequestCreateSerializer,
    SignupRequestSerializer, UserRoleSerializer, UserSerializer,
)


def build_set_password_url(user):
    """Standard Django password-reset token pair — stateless (no extra
    table), and self-invalidating the moment the user actually sets a
    real password, since the token hash incorporates the current
    password value. Shared by signup approval and "forgot password"."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_BASE_URL}/set-password?uid={uid}&token={token}"


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class MeView(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    def list(self, request, *args, **kwargs):
        return Response(self.get_serializer(self.get_object()).data)


class DeviceViewSet(viewsets.ModelViewSet):
    """A device registers/updates itself on login and on push-token
    refresh. Users only ever see their own devices."""

    serializer_class = DeviceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Device.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        device = self.get_object()
        device.is_active = False
        device.save(update_fields=["is_active"])
        return Response({"status": "revoked"})


class UserViewSet(viewsets.ModelViewSet):
    """AR-06 User & Role Management."""

    queryset = User.objects.all().order_by("username")
    serializer_class = UserSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_USERS_MANAGE

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        Device.objects.filter(user=user).update(is_active=False)
        return Response({"status": "deactivated"})


class SignupRequestViewSet(viewsets.ModelViewSet):
    """Public self-service access requests, admin-approved. Anyone can
    submit one (`create`); everything else — seeing the queue, approving,
    rejecting — requires PERM_USERS_MANAGE, the same gate UserViewSet
    uses, since approving one is equivalent to creating a user directly."""

    queryset = SignupRequest.objects.all()
    http_method_names = ["get", "post", "head", "options"]
    required_permission_codes = {
        "list": PERM_USERS_MANAGE,
        "retrieve": PERM_USERS_MANAGE,
        "approve": PERM_USERS_MANAGE,
        "reject": PERM_USERS_MANAGE,
    }

    throttle_scope = "signup_request"

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [HasRolePermission()]

    def get_throttles(self):
        if self.action == "create":
            return [ScopedRateThrottle()]
        return [AnonRateThrottle(), UserRateThrottle()]

    def get_serializer_class(self):
        if self.action == "create":
            return SignupRequestCreateSerializer
        if self.action == "approve":
            return SignupRequestApproveSerializer
        return SignupRequestSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        send_signup_request_submitted(instance)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        signup_request = self.get_object()
        if signup_request.status != SignupRequest.STATUS_PENDING:
            return Response({"detail": "This request has already been decided."}, status=400)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        name_parts = signup_request.name.split(" ", 1)
        try:
            user = User.objects.create_user(
                username=data.get("username") or signup_request.email,
                email=signup_request.email,
                first_name=name_parts[0],
                last_name=name_parts[1] if len(name_parts) > 1 else "",
                phone=signup_request.phone,
                # Explicit None, not the field's own "" default — this
                # column is unique, and a second user left at "" would
                # collide with the first (see UserForm.tsx client-side,
                # which does the same `|| null` for the same reason).
                employee_code=None,
                # No password from the admin — create_user(password=None)
                # calls set_unusable_password() internally. The account
                # only becomes usable once the new user sets their own
                # password via the one-time link below.
                password=None,
            )
        except IntegrityError:
            return Response(
                {"detail": "A user with this username/email already exists."}, status=400
            )

        role = data.get("role")
        if role:
            UserRole.objects.create(user=user, role=role)

        signup_request.status = SignupRequest.STATUS_APPROVED
        signup_request.decided_at = timezone.now()
        signup_request.decided_by = request.user
        signup_request.created_user = user
        signup_request.save(update_fields=["status", "decided_at", "decided_by", "created_user"])

        set_password_url = build_set_password_url(user)
        send_signup_request_approved(signup_request, set_password_url)
        return Response({**SignupRequestSerializer(signup_request).data, "set_password_url": set_password_url})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        signup_request = self.get_object()
        if signup_request.status != SignupRequest.STATUS_PENDING:
            return Response({"detail": "This request has already been decided."}, status=400)

        reason = request.data.get("reason", "")
        signup_request.status = SignupRequest.STATUS_REJECTED
        signup_request.decided_at = timezone.now()
        signup_request.decided_by = request.user
        signup_request.save(update_fields=["status", "decided_at", "decided_by"])

        send_signup_request_rejected(signup_request, reason)
        return Response(SignupRequestSerializer(signup_request).data)


class SetPasswordConfirmView(APIView):
    """Public endpoint behind the one-time set-password link a newly
    approved user is emailed (SignupRequestViewSet.approve issues it).
    The account is created with an unusable password specifically so
    this is the only way it becomes usable — no admin-assigned temp
    password to communicate out-of-band."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        serializer = SetPasswordConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            uid = force_str(urlsafe_base64_decode(data["uid"]))
            user = User.objects.get(pk=uid)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response({"detail": "This link is invalid."}, status=400)

        if not default_token_generator.check_token(user, data["token"]):
            return Response({"detail": "This link is invalid or has expired."}, status=400)

        try:
            validate_password(data["password"], user=user)
        except DjangoValidationError as exc:
            return Response({"detail": " ".join(exc.messages)}, status=400)

        user.set_password(data["password"])
        user.save(update_fields=["password"])
        return Response({"status": "password_set"})


class PasswordResetRequestView(APIView):
    """"Forgot password" for an existing (or freshly-approved but never
    logged in) account — same one-time link mechanism as signup approval
    (build_set_password_url / SetPasswordConfirmView), just triggered by
    the user themselves instead of an admin approving a request.

    Always returns the same generic response regardless of whether the
    email/username actually matches an account — a distinguishable
    response here would let anyone probe which emails have accounts."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    GENERIC_RESPONSE = {"detail": "If that account exists, a password reset link has been sent."}

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["email"].strip()

        user = User.objects.filter(
            Q(email__iexact=identifier) | Q(username__iexact=identifier), is_active=True
        ).first()
        if user:
            send_password_reset_link(user, build_set_password_url(user))

        return Response(self.GENERIC_RESPONSE)


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only: Role.permissions/is_active now only change through
    apps.governance's ChangeRequest propose/approve workflow (see
    apps.accounts.governance) — never a direct write here."""

    queryset = Role.objects.all().order_by("name")
    serializer_class = RoleSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_ROLES_MANAGE


class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_USERS_MANAGE
