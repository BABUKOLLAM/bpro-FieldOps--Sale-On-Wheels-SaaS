from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.filters import SearchFilter

from apps.accounts.constants import PERM_CUSTOMERS_MANAGE, PERM_CUSTOMERS_VIEW
from apps.accounts.permissions import HasRolePermission

from .models import Beat, BeatCustomer, Customer, CustomerCategory
from .serializers import BeatCustomerSerializer, BeatSerializer, CustomerCategorySerializer, CustomerSerializer


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


class BeatCustomerViewSet(viewsets.ModelViewSet):
    """Manages individual stops on a route/beat (AR-08) — add a customer
    at a given visit sequence, remove one. Beat itself (name, assigned
    agent) is managed via BeatViewSet above."""

    queryset = BeatCustomer.objects.select_related("beat", "customer").all()
    serializer_class = BeatCustomerSerializer
    permission_classes = [CustomersPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["beat", "customer"]
