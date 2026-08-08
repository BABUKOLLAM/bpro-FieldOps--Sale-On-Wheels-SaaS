from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response

from apps.accounts.constants import PERM_CUSTOMERS_MANAGE, PERM_CUSTOMERS_VIEW
from apps.accounts.permissions import HasRolePermission
from apps.core.geo import haversine_km

from .models import Beat, BeatCustomer, BeatTemplate, BeatTemplateStop, Customer, CustomerCategory
from .serializers import (
    BeatCustomerSerializer, BeatSerializer, BeatTemplateSerializer, BeatTemplateStopSerializer,
    CustomerCategorySerializer, CustomerSerializer,
)


class CustomersPermission(HasRolePermission):
    read_actions = {"list", "retrieve"}

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        codes = request.user.permission_codes()
        if view.action in self.read_actions:
            return PERM_CUSTOMERS_VIEW in codes or PERM_CUSTOMERS_MANAGE in codes
        return PERM_CUSTOMERS_MANAGE in codes


class CustomerCategoryViewSet(viewsets.ModelViewSet):
    queryset = CustomerCategory.objects.all().order_by("name")
    serializer_class = CustomerCategorySerializer
    permission_classes = [CustomersPermission]


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().order_by("name")
    serializer_class = CustomerSerializer
    permission_classes = [CustomersPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["is_active", "is_blocked", "category"]
    search_fields = ["code", "name", "gstin", "phone"]


class BeatViewSet(viewsets.ModelViewSet):
    queryset = Beat.objects.all().order_by("name")
    serializer_class = BeatSerializer
    permission_classes = [CustomersPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["assigned_agent", "is_active"]

    @action(detail=True, methods=["post"], url_path="optimize-route")
    def optimize_route(self, request, pk=None):
        """FM-07: nearest-neighbor re-sequencing of this beat's stops by
        straight-line (Haversine) distance between outlet addresses — a
        real, useful improvement over an arbitrarily-ordered list, but
        not a capacity/traffic-aware vehicle-routing solver. Stops whose
        customer has no address on file can't be routed and are left in
        their current relative order at the end."""
        beat = self.get_object()
        stops = list(beat.stops.select_related("customer").all())

        located, unlocated = [], []
        for stop in stops:
            address = stop.customer.addresses.first()
            if address and address.latitude is not None and address.longitude is not None:
                located.append((stop, float(address.latitude), float(address.longitude)))
            else:
                unlocated.append(stop)

        ordered = []
        remaining = located[:]
        if remaining:
            ordered.append(remaining.pop(0))
            while remaining:
                current = ordered[-1]
                nearest = min(
                    remaining,
                    key=lambda s: haversine_km(current[1], current[2], s[1], s[2]),
                )
                remaining.remove(nearest)
                ordered.append(nearest)

        sequence = 1
        for stop, _, _ in ordered:
            stop.visit_sequence = sequence
            stop.save(update_fields=["visit_sequence"])
            sequence += 1
        for stop in unlocated:
            stop.visit_sequence = sequence
            stop.save(update_fields=["visit_sequence"])
            sequence += 1

        beat.refresh_from_db()
        return Response(self.get_serializer(beat).data)


class BeatCustomerViewSet(viewsets.ModelViewSet):
    """Manages individual stops on a route/beat (AR-08) — add a customer
    at a given visit sequence, remove one. Beat itself (name, assigned
    agent) is managed via BeatViewSet above."""

    queryset = BeatCustomer.objects.select_related("beat", "customer").all()
    serializer_class = BeatCustomerSerializer
    permission_classes = [CustomersPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["beat", "customer"]


class BeatTemplateViewSet(viewsets.ModelViewSet):
    """A reusable trip plan, distinct from a live Beat (see
    BeatTemplate's docstring) — editing/reordering a template's stops
    never touches any Beat already instantiated from it."""

    queryset = BeatTemplate.objects.all().order_by("name")
    serializer_class = BeatTemplateSerializer
    permission_classes = [CustomersPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["is_active"]

    @action(detail=True, methods=["post"])
    def instantiate(self, request, pk=None):
        """Copies this template's stops into a brand-new Beat +
        BeatCustomer rows. The template itself is untouched — later edits
        to it never retroactively change a Beat already created this way."""
        template = self.get_object()
        beat = Beat.objects.create(
            name=request.data.get("name") or f"{template.name} ({timezone.now():%d-%b-%Y})",
            assigned_agent_id=request.data.get("assigned_agent") or None,
        )
        BeatCustomer.objects.bulk_create([
            BeatCustomer(beat=beat, customer_id=stop.customer_id, visit_sequence=stop.visit_sequence)
            for stop in template.stops.all()
        ])
        beat.refresh_from_db()
        return Response(BeatSerializer(beat).data, status=201)


class BeatTemplateStopViewSet(viewsets.ModelViewSet):
    queryset = BeatTemplateStop.objects.select_related("template", "customer").all()
    serializer_class = BeatTemplateStopSerializer
    permission_classes = [CustomersPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["template", "customer"]
