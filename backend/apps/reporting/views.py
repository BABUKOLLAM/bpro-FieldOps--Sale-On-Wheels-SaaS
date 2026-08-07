from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.constants import PERM_REPORTING_DASHBOARD_VIEW
from apps.accounts.permissions import HasRolePermission
from apps.fleet.models import Trip
from apps.integrations.models import SyncLogEntry
from apps.sales.models import Invoice, Receipt

from .models import Target
from .serializers import TargetSerializer


class DashboardView(APIView):
    """AR-01 Live Dashboard: today's sales/collections, active trips, and
    pending exceptions — the single screen back-office/finance/supervisors
    land on."""

    permission_classes = [HasRolePermission]
    required_permission_code = PERM_REPORTING_DASHBOARD_VIEW

    def get(self, request):
        today = timezone.localdate()

        todays_invoices = Invoice.objects.filter(invoice_date=today)
        todays_receipts = Receipt.objects.filter(received_at__date=today)

        data = {
            "date": today,
            "todays_sales_total": todays_invoices.aggregate(t=Sum("grand_total"))["t"] or Decimal("0"),
            "todays_sales_count": todays_invoices.count(),
            "todays_collections_total": todays_receipts.aggregate(t=Sum("amount"))["t"] or Decimal("0"),
            "active_trips_count": Trip.objects.filter(status=Trip.STATUS_IN_PROGRESS).count(),
            "pending_credit_review_count": Invoice.objects.filter(
                credit_check_status=Invoice.CREDIT_PENDING_REVIEW
            ).count(),
            "sync_failure_count": SyncLogEntry.objects.filter(
                status__in=[SyncLogEntry.STATUS_FAILED, SyncLogEntry.STATUS_FAILED_PERMANENT]
            ).count(),
            "recent_invoices": list(
                todays_invoices.order_by("-created_at")[:10].values(
                    "id", "invoice_no", "customer__name", "agent__username", "grand_total",
                    "credit_check_status", "sync_status", "created_at", "signature_image",
                )
            ),
            "agents_by_status": list(
                Trip.objects.filter(start_time__date=today)
                .values("status")
                .annotate(count=Count("id"))
            ),
        }
        return Response(data)


class TargetViewSet(viewsets.ModelViewSet):
    queryset = Target.objects.select_related("agent", "beat")
    serializer_class = TargetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or PERM_REPORTING_DASHBOARD_VIEW in user.permission_codes():
            return self.queryset
        return self.queryset.filter(agent=user)
