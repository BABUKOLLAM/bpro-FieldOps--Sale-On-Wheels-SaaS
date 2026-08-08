from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class PlatformStatusView(APIView):
    """The platform/control namespace's only endpoint for now — Phase 1
    just proves the routing itself works (a request with no resolvable
    tenant lands here, not in the normal tenant-scoped app). Real Super
    Admin operations (tenant provisioning API, PlatformAdmin login,
    approval-queue endpoints) are Phase 2 scope — deliberately not built
    yet rather than stubbed out unauthenticated, since this namespace
    currently has no auth of its own to gate them with."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "platform": "vansales",
            "tenant_resolved": False,
            "detail": "No tenant matched this host — nothing else is served from here yet.",
        })
