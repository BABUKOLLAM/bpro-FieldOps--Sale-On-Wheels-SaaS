from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.constants import PERM_MASTER_SETTINGS_MANAGE, PERM_REPORTING_DASHBOARD_VIEW
from apps.accounts.permissions import HasRolePermission

from .models import DeviceToken, MessageTemplate, NotificationGatewaySettings, NotificationLog
from .serializers import (
    DeviceTokenSerializer, MessageTemplateSerializer, NotificationGatewaySettingsSerializer,
    NotificationLogSerializer,
)


class DeviceTokenViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """A device registers/deregisters its own push token — never another
    user's, and never lists anyone else's (a token is sensitive)."""

    serializer_class = DeviceTokenSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DeviceToken.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # update_or_create semantics: a re-registered token (app
        # reinstall, token refresh) must not 409 on the unique constraint.
        token = serializer.validated_data["token"]
        DeviceToken.objects.update_or_create(
            token=token,
            defaults={
                "user": self.request.user,
                "platform": serializer.validated_data["platform"],
                "provider": serializer.validated_data.get("provider", "fcm"),
                "is_active": True,
            },
        )


class NotificationLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Back-office visibility into every push attempt (FR-18) — reuses
    the dashboard-view permission since this is monitoring, not a new
    permission domain of its own. A field agent sees only their own."""

    serializer_class = NotificationLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = NotificationLog.objects.select_related("user")
        if user.is_superuser or PERM_REPORTING_DASHBOARD_VIEW in user.permission_codes():
            return qs
        return qs.filter(user=user)


class NotificationGatewaySettingsViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only: sms_gateway_url now only changes through
    apps.governance's ChangeRequest workflow (see
    apps/notifications/governance.py); fcm_server_key/sms_gateway_api_key
    stay Django-admin/shell only (see apps/notifications/models.py).
    Always exactly one row — auto-provisioned on first access."""

    serializer_class = NotificationGatewaySettingsSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_MASTER_SETTINGS_MANAGE

    def get_queryset(self):
        NotificationGatewaySettings.get_solo()
        return NotificationGatewaySettings.objects.all()


class MessageTemplateViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only: title_template/body_template now only change through
    apps.governance's ChangeRequest workflow (see
    apps/notifications/governance.py). Always exactly the KEY_CHOICES
    rows — auto-seeded from the original hardcoded defaults on first
    access (see MessageTemplate.seed_defaults)."""

    serializer_class = MessageTemplateSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_MASTER_SETTINGS_MANAGE

    def get_queryset(self):
        MessageTemplate.seed_defaults()
        return MessageTemplate.objects.all().order_by("key")
