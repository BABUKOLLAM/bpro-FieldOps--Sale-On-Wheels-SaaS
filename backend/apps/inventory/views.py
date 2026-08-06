from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.constants import PERM_INVENTORY_MANAGE, PERM_INVENTORY_STOCK_TRANSFER_OWN
from apps.accounts.permissions import HasRolePermission

from .models import Godown, StockLedgerEntry, StockTransfer, VanStock
from .serializers import (
    GodownSerializer, StockLedgerEntrySerializer, StockTransferSerializer, VanStockSerializer,
)
from .services import complete_stock_transfer


class GodownViewSet(viewsets.ModelViewSet):
    queryset = Godown.objects.all().order_by("name")
    serializer_class = GodownSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_INVENTORY_MANAGE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["godown_type", "assigned_agent", "is_active"]


class VanStockViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Read-only: what's currently on board a given van/godown (FM-09).
    A field agent sees only their own assigned godown's stock."""

    serializer_class = VanStockSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["godown", "item"]

    def get_queryset(self):
        qs = VanStock.objects.select_related("item", "godown")
        user = self.request.user
        if user.is_superuser or PERM_INVENTORY_MANAGE in user.permission_codes():
            return qs
        return qs.filter(godown__assigned_agent=user)


class StockLedgerEntryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = StockLedgerEntrySerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_INVENTORY_MANAGE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["godown", "item", "txn_type"]
    queryset = StockLedgerEntry.objects.select_related("godown", "item").all()


class StockTransferViewSet(viewsets.ModelViewSet):
    """Van load / unload (FR-07) and warehouse transfers. A field agent can
    create and complete their own transfers; managers see/manage all."""

    serializer_class = StockTransferSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["transfer_type", "status", "agent"]

    def get_queryset(self):
        qs = StockTransfer.objects.prefetch_related("lines").all()
        user = self.request.user
        if user.is_superuser or PERM_INVENTORY_MANAGE in user.permission_codes():
            return qs
        return qs.filter(agent=user)

    def perform_create(self, serializer):
        user = self.request.user
        if not (
            user.is_superuser
            or PERM_INVENTORY_MANAGE in user.permission_codes()
            or PERM_INVENTORY_STOCK_TRANSFER_OWN in user.permission_codes()
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Not allowed to create stock transfers.")
        serializer.save(agent=serializer.validated_data.get("agent") or user)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        transfer = self.get_object()
        if transfer.status == StockTransfer.STATUS_COMPLETED:
            return Response({"detail": "Already completed."}, status=400)
        complete_stock_transfer(transfer)
        return Response(self.get_serializer(transfer).data)
