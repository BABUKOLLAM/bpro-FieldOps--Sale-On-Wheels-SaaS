from rest_framework import mixins, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.constants import PERM_MASTER_SETTINGS_MANAGE, PERM_SALES_VIEW_ALL
from apps.accounts.permissions import HasRolePermission
from apps.sales.models import Invoice

from .models import PaymentGatewayConnection, PaymentOrder
from .serializers import CreatePaymentOrderSerializer, PaymentGatewayConnectionSerializer, PaymentOrderSerializer
from .services import PaymentVerificationError, create_payment_order, verify_and_record_payment


def _can_view_all(user):
    return user.is_superuser or PERM_SALES_VIEW_ALL in user.permission_codes()


class PaymentOrderViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """§18 UPI/card collection — an agent initiates a payment order
    against their own invoice; supervisors/back-office/finance see all.
    The order itself is inert (see services.create_payment_order); it
    only ever moves to STATUS_PAID via a verified gateway webhook."""

    queryset = PaymentOrder.objects.select_related("invoice", "receipt")
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return CreatePaymentOrderSerializer if self.action == "create" else PaymentOrderSerializer

    def get_queryset(self):
        if _can_view_all(self.request.user):
            return self.queryset
        return self.queryset.filter(invoice__agent=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = CreatePaymentOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invoice = Invoice.objects.select_related("agent").get(pk=serializer.validated_data["invoice"])
        user = request.user
        if invoice.agent_id != user.id and not _can_view_all(user):
            raise PermissionDenied("Not allowed to collect payment for this invoice.")

        order = create_payment_order(invoice, serializer.validated_data["amount"])
        return Response(PaymentOrderSerializer(order).data, status=201)


class PaymentGatewayConnectionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only: gateway_type/is_active now only change through
    apps.governance's ChangeRequest workflow (see
    apps/payments/governance.py) — credentials stay Django-admin/shell
    only, same posture as apps.integrations.ERPConnection."""

    queryset = PaymentGatewayConnection.objects.all()
    serializer_class = PaymentGatewayConnectionSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_MASTER_SETTINGS_MANAGE


class PaymentWebhookView(APIView):
    """Called by the configured payment gateway, never by the app itself
    — unauthenticated (the gateway can't hold our JWTs), trusted only via
    HMAC signature verification inside verify_and_record_payment. A
    signature mismatch is rejected outright, never acted on."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        # Must read .body before .data — DRF's JSON parser consumes the
        # underlying stream, and Django raises RawPostDataException on a
        # .body access after that.
        raw_body = request.body
        signature = request.headers.get("X-Payment-Signature", "")
        order_id = request.data.get("order_id", "")
        try:
            order = verify_and_record_payment(raw_body, signature, order_id)
        except PaymentVerificationError:
            return Response({"detail": "Invalid signature."}, status=400)
        return Response({"status": order.status})
