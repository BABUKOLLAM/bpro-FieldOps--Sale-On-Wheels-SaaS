import secrets

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.constants import (
    PERM_INTEGRATIONS_SYNC_RETRY, PERM_INTEGRATIONS_SYNC_VIEW, PERM_INTEGRATIONS_WEBHOOK_MANAGE,
)
from apps.accounts.permissions import HasRolePermission

from .authentication import ConnectorAPIKeyAuthentication
from .models import ERPConnection, SyncLogEntry, Webhook, WebhookDeliveryLog
from .serializers import (
    ConnectorJobResultSerializer, ConnectorJobSerializer, ERPConnectionSerializer, SyncLogEntrySerializer,
    WebhookDeliveryLogSerializer, WebhookSerializer,
)
from .tasks import retry_sync_job


class ERPConnectionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only: erp_type/sync_mode/batch_interval_minutes/is_active now
    only change through apps.governance's ChangeRequest workflow (see
    apps/integrations/governance.py) — credentials were already
    write-only-via-admin before this (never exposed on the serializer)."""

    queryset = ERPConnection.objects.all()
    serializer_class = ERPConnectionSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_INTEGRATIONS_SYNC_VIEW


class SyncLogEntryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """AR-09 Integration & Sync Monitor: shows every sync attempt with
    retry/manual-resolution tools."""

    queryset = SyncLogEntry.objects.order_by("-created_at")
    serializer_class = SyncLogEntrySerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_INTEGRATIONS_SYNC_VIEW
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "entity_type"]

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        if PERM_INTEGRATIONS_SYNC_RETRY not in request.user.permission_codes() and not request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Not allowed to retry sync jobs.")
        entry = self.get_object()
        retry_sync_job.delay(str(entry.id))
        entry.refresh_from_db()
        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        """Mark a permanently-failed job as manually resolved (e.g. fixed
        directly in Tally) without further automated retries."""
        entry = self.get_object()
        entry.status = SyncLogEntry.STATUS_ACKNOWLEDGED
        entry.error_message = f"Manually resolved by {request.user}: {request.data.get('note', '')}"
        entry.save(update_fields=["status", "error_message"])
        return Response(self.get_serializer(entry).data)


class ConnectorJobViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Polled by the on-prem connector agent (see
    apps/integrations/connector_agent/agent.py) — never by a browser or
    the mobile app. Authenticated by a shared deployment API key, not JWT.
    """

    authentication_classes = [ConnectorAPIKeyAuthentication]
    permission_classes = []  # authentication itself is the gate
    serializer_class = ConnectorJobSerializer

    def get_queryset(self):
        return SyncLogEntry.objects.filter(status=SyncLogEntry.STATUS_PENDING).order_by("created_at")[:50]

    @action(detail=True, methods=["post"])
    def result(self, request, pk=None):
        entry = SyncLogEntry.objects.get(pk=pk)
        result = ConnectorJobResultSerializer(data=request.data)
        result.is_valid(raise_exception=True)
        data = result.validated_data

        if data["status"] == "acknowledged":
            entry.status = SyncLogEntry.STATUS_ACKNOWLEDGED
            entry.erp_reference_id = data.get("erp_reference_id", "")
            entry.error_message = ""
        else:
            from .tasks import _mark_failed

            _mark_failed(entry, data.get("error_message", "Connector agent reported failure."))
            return Response({"status": entry.status})

        entry.response_payload = data.get("response_payload", {})
        entry.save(update_fields=["status", "erp_reference_id", "error_message", "response_payload"])
        return Response({"status": entry.status})


class WebhookViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
    mixins.DestroyModelMixin, viewsets.GenericViewSet,
):
    """BRD 11.3 generic integration layer — subscription management.
    Gated on a dedicated permission (not integrations.sync.view) since
    this surface accepts a secret used to sign outbound deliveries.

    Adding/removing a subscription stays a direct action (unlike Role or
    Company, having several webhooks is the normal, expected shape — it's
    not a single seeded row). But *editing* an existing one
    (name/url/event_types/is_active) now goes through apps.governance's
    ChangeRequest workflow instead (see apps/integrations/governance.py)
    — no PATCH/PUT here (no UpdateModelMixin). `secret` deliberately never
    goes through that generic JSON-diff flow (a ChangeRequest's
    proposed_changes/previous_snapshot are plain JSON, not encrypted) —
    rotate it via the dedicated `rotate_secret` action below instead."""

    queryset = Webhook.objects.order_by("name")
    serializer_class = WebhookSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_INTEGRATIONS_WEBHOOK_MANAGE

    @action(detail=True, methods=["post"])
    def rotate_secret(self, request, pk=None):
        webhook = self.get_object()
        webhook.secret = request.data.get("secret") or secrets.token_urlsafe(32)
        webhook.save(update_fields=["secret"])
        return Response({"status": "rotated"})


class WebhookDeliveryLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = WebhookDeliveryLog.objects.select_related("webhook").order_by("-created_at")
    serializer_class = WebhookDeliveryLogSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_INTEGRATIONS_WEBHOOK_MANAGE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["webhook", "status", "event_type"]
