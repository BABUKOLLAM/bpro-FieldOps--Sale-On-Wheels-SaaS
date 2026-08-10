from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.constants import (
    PERM_ATTENDANCE_CREATE_OWN, PERM_EXPENSES_CREATE_OWN, PERM_FLEET_TRIP_MANAGE_OWN, PERM_SALES_INVOICE_CREATE,
)
from apps.catalog.models import Item, PriceList, Scheme
from apps.company.models import Company, GSTRegistration
from apps.customers.models import Beat, Customer
from apps.fleet.models import Trip
from apps.inventory.models import VanStock

from .models import PushRequestLog
from .serializers import PullResponseSerializer, PushRequestSerializer, PUSH_HANDLERS

# Which permission a push item requires, and whether the entity has an
# `agent` field that must be forced to the authenticated user — a mobile
# client must never be able to push a transaction attributed to someone
# else. trip_checkpoint has no agent field of its own; it's guarded
# instead by checking the referenced trip's ownership (see below).
_PUSH_PERMISSION_REQUIRED = {
    "invoice": PERM_SALES_INVOICE_CREATE,
    "trip": PERM_FLEET_TRIP_MANAGE_OWN,
    "trip_checkpoint": PERM_FLEET_TRIP_MANAGE_OWN,
    "expense": PERM_EXPENSES_CREATE_OWN,
    "location_ping": PERM_FLEET_TRIP_MANAGE_OWN,
    "attendance": PERM_ATTENDANCE_CREATE_OWN,
}
_FORCE_AGENT_FIELD = {"invoice", "trip", "expense", "location_ping", "attendance"}


class PullView(APIView):
    """
    Cursor-based pull: returns master/reference data relevant to the
    requesting agent, changed since `since` (ISO datetime query param,
    omitted/empty for a full initial pull). Scoped to the agent's own
    assigned beats/customers rather than the whole tenant catalog, per the
    offline-sync design in docs/architecture.md — this bounds payload size
    and avoids leaking other agents' assigned customer lists.

    Note: this is a pragmatic MVP implementation of the pull side of the
    design (a fixed set of typed collections, not a fully generic
    per-table WatermelonDB diff protocol) — sufficient for the mobile
    reference build's read-only synced tables (Item/PriceList/Scheme/
    Customer/Beat/VanStock) and straightforward to extend table-by-table.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        since = request.query_params.get("since")
        since_dt = parse_datetime(since) if since else None

        user = request.user
        beats = Beat.objects.filter(assigned_agent=user, is_active=True).prefetch_related("stops__customer")
        customer_ids = set()
        for beat in beats:
            customer_ids.update(beat.stops.values_list("customer_id", flat=True))

        items_qs = Item.objects.filter(is_active=True)
        price_lists_qs = PriceList.objects.filter(is_active=True)
        schemes_qs = Scheme.objects.filter(is_active=True)
        customers_qs = Customer.objects.filter(id__in=customer_ids)
        van_stock_qs = VanStock.objects.filter(godown__assigned_agent=user)
        gst_registrations_qs = GSTRegistration.objects.all()

        if since_dt:
            items_qs = items_qs.filter(updated_at__gt=since_dt)
            price_lists_qs = price_lists_qs.filter(updated_at__gt=since_dt)
            schemes_qs = schemes_qs.filter(updated_at__gt=since_dt)
            customers_qs = customers_qs.filter(updated_at__gt=since_dt)
            van_stock_qs = van_stock_qs.filter(updated_at__gt=since_dt)
            gst_registrations_qs = gst_registrations_qs.filter(updated_at__gt=since_dt)

        # Singleton, always sent in full (never filtered by `since`) — see
        # apps.company.models.Company docstring; the payload is a handful
        # of strings, so there's no size concern in always including it.
        # This lets SpotBillingScreen build a §18 UPI QR fully offline,
        # without a network round trip at the point of sale itself.
        company = Company.objects.first()
        company_data = {
            "legal_name": company.legal_name if company else "",
            "display_name": company.display_name if company else "",
            "upi_vpa": company.upi_vpa if company else "",
        }

        data = {
            "server_timestamp": timezone.now(),
            "company": company_data,
            "gst_registrations": gst_registrations_qs,
            "items": items_qs,
            "price_lists": price_lists_qs,
            "schemes": schemes_qs,
            "customers": customers_qs,
            "beats": beats,
            "van_stock": van_stock_qs,
        }
        return Response(PullResponseSerializer(data).data)


class PushView(APIView):
    """
    Idempotent push: each item's `payload.id` (client-generated UUID) is
    checked against PushRequestLog before being handed to the matching
    entity serializer. A retried push for an id already applied returns
    the same "applied" result without re-running side effects (stock
    deduction, credit check, Tally sync enqueue) a second time.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PushRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        device = request.user.devices.filter(is_active=True).order_by("-created_at").first()
        results = []

        user = request.user
        user_permission_codes = user.permission_codes()

        for item in serializer.validated_data["items"]:
            entity_type = item["entity_type"]
            payload = item["payload"]
            idempotency_key = payload.get("id")

            existing = PushRequestLog.objects.filter(idempotency_key=idempotency_key).first() if idempotency_key else None
            if existing:
                results.append({"id": str(idempotency_key), "entity_type": entity_type, "status": existing.status, "error": existing.error_message})
                continue

            required_code = _PUSH_PERMISSION_REQUIRED.get(entity_type)
            if required_code and not (user.is_superuser or required_code in user_permission_codes):
                results.append({"id": str(idempotency_key), "entity_type": entity_type, "status": "rejected", "error": "Not permitted."})
                continue

            if entity_type in _FORCE_AGENT_FIELD:
                payload["agent"] = str(user.id)
            elif entity_type == "trip_checkpoint":
                trip_id = payload.get("trip")
                if not Trip.objects.filter(id=trip_id, agent=user).exists():
                    results.append({"id": str(idempotency_key), "entity_type": entity_type, "status": "rejected", "error": "Trip does not belong to this agent."})
                    continue

            handler_serializer_cls = PUSH_HANDLERS[entity_type]
            item_serializer = handler_serializer_cls(data=payload)
            if item_serializer.is_valid():
                try:
                    with transaction.atomic():
                        instance = item_serializer.save()
                        if device:
                            PushRequestLog.objects.create(
                                device=device, entity_type=entity_type,
                                idempotency_key=instance.id, status=PushRequestLog.STATUS_APPLIED,
                            )
                except IntegrityError:
                    # Concurrent retry of the same push landed first — treat as
                    # already applied rather than a failure.
                    results.append({"id": str(idempotency_key), "entity_type": entity_type, "status": "applied"})
                    continue
                results.append({"id": str(instance.id), "entity_type": entity_type, "status": "applied"})
            else:
                error_message = str(item_serializer.errors)
                if device and idempotency_key:
                    PushRequestLog.objects.create(
                        device=device, entity_type=entity_type, idempotency_key=idempotency_key,
                        status=PushRequestLog.STATUS_REJECTED, error_message=error_message,
                    )
                results.append({"id": str(idempotency_key), "entity_type": entity_type, "status": "rejected", "error": error_message})

        if device:
            device.last_synced_at = timezone.now()
            device.save(update_fields=["last_synced_at"])

        return Response({"results": results})
