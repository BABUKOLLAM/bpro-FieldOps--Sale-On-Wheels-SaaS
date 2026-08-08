from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.constants import PERM_REPORTING_DASHBOARD_VIEW

from .models import DeviceToken, NotificationLog
from .serializers import DeviceTokenSerializer, NotificationLogSerializer


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
