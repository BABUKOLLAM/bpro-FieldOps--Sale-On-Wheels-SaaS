from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth import IsPlatformAdmin, PlatformAdminJWTAuthentication, tokens_for_platform_admin
from .models import Tenant
from .provisioning import ProvisioningError, provision_tenant
from .serializers import PlatformAdminLoginSerializer, ProvisionTenantSerializer, TenantSerializer


class PlatformStatusView(APIView):
    """Proves the routing itself works — a request with no resolvable
    tenant lands here by default. Unauthenticated by design: it reveals
    nothing about any tenant or the platform's own accounts."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "platform": "vansales",
            "tenant_resolved": False,
            "detail": "No tenant matched this host — nothing else is served from here unauthenticated.",
        })


class PlatformLoginView(APIView):
    """PlatformAdmin's own login — separate from apps.accounts' JWT flow
    (see apps.tenancy.auth). Issues a token carrying the 'platform_admin'
    claim that every other platform-namespace view requires."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PlatformAdminLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        admin = serializer.validated_data["admin"]
        tokens = tokens_for_platform_admin(admin)
        return Response({**tokens, "email": admin.email})


class TenantListCreateView(APIView):
    """The self-service tenant registry: list existing tenants, or
    provision a new one. Only slug/name ever come from the request — see
    apps.tenancy.provisioning.provision_tenant's docstring for why every
    DB connection detail is always derived server-side instead."""

    authentication_classes = [PlatformAdminJWTAuthentication]
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        tenants = Tenant.objects.all().order_by("-created_at")
        return Response(TenantSerializer(tenants, many=True).data)

    def post(self, request):
        serializer = ProvisionTenantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            tenant = provision_tenant(serializer.validated_data["slug"], serializer.validated_data["name"])
        except ProvisioningError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response(TenantSerializer(tenant).data, status=201)
