from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.constants import PERM_REPORTING_DASHBOARD_VIEW
from apps.accounts.permissions import HasRolePermission
from apps.fleet.models import LocationPing, Trip, TripCheckpoint
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


class LiveMapView(APIView):
    """AR-03 Real-Time Activity Tracking: for every agent currently on an
    in-progress trip, their latest known location, trip status, and
    beat-stop visit progress — the server does the joins so admin-web's
    map doesn't have to stitch together multiple calls, same approach as
    DashboardView."""

    permission_classes = [HasRolePermission]
    required_permission_code = PERM_REPORTING_DASHBOARD_VIEW

    def get(self, request):
        active_trips = (
            Trip.objects.filter(status=Trip.STATUS_IN_PROGRESS)
            .select_related("agent", "vehicle", "beat")
            .prefetch_related("beat__stops__customer__addresses")
        )

        agents_data = []
        for trip in active_trips:
            last_ping = (
                LocationPing.objects.filter(trip=trip).order_by("-recorded_at").first()
                or LocationPing.objects.filter(agent=trip.agent).order_by("-recorded_at").first()
            )
            if last_ping:
                last_location = {
                    "latitude": last_ping.latitude, "longitude": last_ping.longitude,
                    "recorded_at": last_ping.recorded_at,
                }
            elif trip.start_latitude is not None and trip.start_longitude is not None:
                last_location = {
                    "latitude": trip.start_latitude, "longitude": trip.start_longitude,
                    "recorded_at": trip.start_time,
                }
            else:
                last_location = None

            visited_customer_ids = set(
                TripCheckpoint.objects.filter(trip=trip, check_in_time__isnull=False).values_list(
                    "customer_id", flat=True
                )
            )

            stops = []
            if trip.beat:
                for stop in trip.beat.stops.all():
                    address = stop.customer.addresses.first()
                    stops.append({
                        "customer_id": stop.customer_id,
                        "customer_name": stop.customer.name,
                        "visit_sequence": stop.visit_sequence,
                        "latitude": address.latitude if address else None,
                        "longitude": address.longitude if address else None,
                        "status": "visited" if stop.customer_id in visited_customer_ids else "pending",
                    })

            agents_data.append({
                "agent_id": trip.agent_id,
                "agent_name": trip.agent.get_full_name() or trip.agent.username,
                "trip_id": trip.id,
                "trip_status": trip.status,
                "vehicle_reg_no": trip.vehicle.reg_no if trip.vehicle else None,
                "last_location": last_location,
                "beat_name": trip.beat.name if trip.beat else None,
                "stops": stops,
            })

        return Response({"agents": agents_data})


class TargetViewSet(viewsets.ModelViewSet):
    queryset = Target.objects.select_related("agent", "beat")
    serializer_class = TargetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or PERM_REPORTING_DASHBOARD_VIEW in user.permission_codes():
            return self.queryset
        return self.queryset.filter(agent=user)
