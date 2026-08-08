from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.filters import SearchFilter

from apps.accounts.constants import PERM_CATALOG_MANAGE, PERM_CATALOG_VIEW
from apps.accounts.permissions import HasRolePermission

from .models import Item, ItemCategory, PriceList, Scheme, SchemeBXGY, UOM
from .serializers import (
    ItemCategorySerializer, ItemSerializer, PriceListSerializer, SchemeBXGYSerializer, SchemeSerializer, UOMSerializer,
)


class CatalogPermission(HasRolePermission):
    required_permission_codes = {
        "list": PERM_CATALOG_VIEW, "retrieve": PERM_CATALOG_VIEW,
        "create": PERM_CATALOG_MANAGE, "update": PERM_CATALOG_MANAGE,
        "partial_update": PERM_CATALOG_MANAGE, "destroy": PERM_CATALOG_MANAGE,
    }

    def has_permission(self, request, view):
        codes = self.required_permission_codes
        code = codes.get(view.action)
        if code is None or (request.user and request.user.is_superuser):
            return bool(request.user and request.user.is_authenticated)
        return code in request.user.permission_codes()


class UOMViewSet(viewsets.ModelViewSet):
    queryset = UOM.objects.all().order_by("code")
    serializer_class = UOMSerializer
    permission_classes = [CatalogPermission]


class ItemCategoryViewSet(viewsets.ModelViewSet):
    queryset = ItemCategory.objects.all().order_by("name")
    serializer_class = ItemCategorySerializer
    permission_classes = [CatalogPermission]


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all().order_by("name")
    serializer_class = ItemSerializer
    permission_classes = [CatalogPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["is_active", "category", "barcode"]
    search_fields = ["sku", "name", "barcode"]


class PriceListViewSet(viewsets.ModelViewSet):
    queryset = PriceList.objects.all().order_by("name")
    serializer_class = PriceListSerializer
    permission_classes = [CatalogPermission]


class SchemeViewSet(viewsets.ModelViewSet):
    queryset = Scheme.objects.all().order_by("-valid_from")
    serializer_class = SchemeSerializer
    permission_classes = [CatalogPermission]


class SchemeBXGYViewSet(viewsets.ModelViewSet):
    queryset = SchemeBXGY.objects.all().order_by("-valid_from")
    serializer_class = SchemeBXGYSerializer
    permission_classes = [CatalogPermission]
