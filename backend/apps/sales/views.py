from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.constants import (
    PERM_CUSTOMERS_CREDIT_OVERRIDE, PERM_SALES_INVOICE_CREATE, PERM_SALES_ORDER_CREATE,
    PERM_SALES_RECEIPT_CREATE, PERM_SALES_RETURN_CREATE, PERM_SALES_VIEW_ALL,
)

from .models import CreditNote, Invoice, Receipt, SalesOrder
from .serializers import CreditNoteSerializer, InvoiceSerializer, ReceiptSerializer, SalesOrderSerializer
from .services import send_delivery_otp, verify_delivery_otp


def _can_view_all(user):
    return user.is_superuser or PERM_SALES_VIEW_ALL in user.permission_codes()


class OwnScopedViewSet(viewsets.ModelViewSet):
    """Shared scoping: a field agent sees/creates only their own records
    (agent=request.user); supervisors/back-office/finance see all."""

    agent_field = "agent"
    create_permission_code = None

    def get_queryset(self):
        qs = self.queryset
        if _can_view_all(self.request.user):
            return qs
        return qs.filter(**{self.agent_field: self.request.user})

    def perform_create(self, serializer):
        user = self.request.user
        if not (
            user.is_superuser
            or self.create_permission_code in user.permission_codes()
            or _can_view_all(user)
        ):
            raise PermissionDenied("Not allowed to create this record.")
        serializer.save(agent=serializer.validated_data.get("agent") or user)


class SalesOrderViewSet(OwnScopedViewSet):
    queryset = SalesOrder.objects.prefetch_related("lines").select_related("customer", "agent")
    serializer_class = SalesOrderSerializer
    permission_classes = [IsAuthenticated]
    create_permission_code = PERM_SALES_ORDER_CREATE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "customer", "agent"]


class InvoiceViewSet(OwnScopedViewSet):
    queryset = Invoice.objects.prefetch_related("lines").select_related("customer", "agent", "gst_registration")
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    create_permission_code = PERM_SALES_INVOICE_CREATE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["payment_status", "credit_check_status", "sync_status", "customer", "agent"]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # A supervisor/finance user creating or resolving an invoice on a
        # customer over their credit limit can pass override=true to
        # approve it inline, rather than leaving it pending_review (AR-04).
        if self.request.data.get("override") and PERM_CUSTOMERS_CREDIT_OVERRIDE in self.request.user.permission_codes():
            context["credit_override_by"] = self.request.user
            context["credit_override_reason"] = self.request.data.get("override_reason", "")
        return context

    @action(detail=True, methods=["post"], url_path="approve-credit")
    def approve_credit(self, request, pk=None):
        """AR-04: supervisor/finance approves a pending_review invoice."""
        if PERM_CUSTOMERS_CREDIT_OVERRIDE not in request.user.permission_codes() and not request.user.is_superuser:
            raise PermissionDenied("Not allowed to approve credit overrides.")
        invoice = self.get_object()
        invoice.credit_check_status = Invoice.CREDIT_OVERRIDDEN
        invoice.credit_override_by = request.user
        invoice.credit_override_reason = request.data.get("reason", "")
        invoice.save(update_fields=["credit_check_status", "credit_override_by", "credit_override_reason"])
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="send-delivery-otp")
    def send_delivery_otp_action(self, request, pk=None):
        """FR-12 proof-of-delivery, the OTP alternative to a signature."""
        invoice = self.get_object()
        send_delivery_otp(invoice)
        return Response({"sent": True})

    @action(detail=True, methods=["post"], url_path="verify-delivery-otp")
    def verify_delivery_otp_action(self, request, pk=None):
        invoice = self.get_object()
        code = request.data.get("code", "")
        verify_delivery_otp(invoice, code)
        return Response(self.get_serializer(invoice).data)


class ReceiptViewSet(OwnScopedViewSet):
    queryset = Receipt.objects.prefetch_related("allocations").select_related("customer", "agent")
    serializer_class = ReceiptSerializer
    permission_classes = [IsAuthenticated]
    create_permission_code = PERM_SALES_RECEIPT_CREATE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["mode", "sync_status", "customer", "agent"]


class CreditNoteViewSet(OwnScopedViewSet):
    queryset = CreditNote.objects.prefetch_related("lines").select_related("customer", "agent", "original_invoice")
    serializer_class = CreditNoteSerializer
    permission_classes = [IsAuthenticated]
    create_permission_code = PERM_SALES_RETURN_CREATE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["sync_status", "customer", "agent"]
