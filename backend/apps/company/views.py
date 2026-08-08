from rest_framework import viewsets

from apps.accounts.constants import PERM_MASTER_SETTINGS_MANAGE
from apps.accounts.permissions import HasRolePermission

from .models import Company, GSTRegistration
from .serializers import CompanySerializer, GSTRegistrationSerializer


class CompanyViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only: edits go through apps.governance's ChangeRequest
    propose/approve workflow (see apps/company/governance.py), same
    lock-down as apps.accounts.RoleViewSet."""

    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_MASTER_SETTINGS_MANAGE


class GSTRegistrationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GSTRegistration.objects.select_related("company").order_by("state")
    serializer_class = GSTRegistrationSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_MASTER_SETTINGS_MANAGE
