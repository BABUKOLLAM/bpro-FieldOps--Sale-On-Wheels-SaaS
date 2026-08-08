from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.constants import PERM_MASTER_SETTINGS_MANAGE
from apps.accounts.permissions import HasRolePermission

from .models import Company, GSTRegistration
from .serializers import CompanySerializer, GSTRegistrationSerializer


class CompanyViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only: legal_name/display_name/fy_start_month/is_active edits
    go through apps.governance's ChangeRequest propose/approve workflow
    (see apps/company/governance.py), same lock-down as
    apps.accounts.RoleViewSet. `logo` is the one field that bypasses that
    entirely (see Company.logo's docstring) — uploaded directly through
    the upload_logo action below."""

    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_MASTER_SETTINGS_MANAGE

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser, JSONParser])
    def upload_logo(self, request, pk=None):
        company = self.get_object()
        logo = request.FILES.get("logo")
        if not logo:
            raise ValidationError({"logo": "No file provided."})
        company.logo = logo
        company.save(update_fields=["logo"])
        return Response(self.get_serializer(company).data)


class GSTRegistrationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GSTRegistration.objects.select_related("company").order_by("state")
    serializer_class = GSTRegistrationSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_MASTER_SETTINGS_MANAGE
