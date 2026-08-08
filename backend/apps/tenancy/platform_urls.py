"""URLconf used only for requests TenantResolutionMiddleware couldn't
resolve to a tenant — see apps/tenancy/middleware.py's request.urlconf
override. Deliberately minimal in Phase 1; see PlatformStatusView."""
from django.urls import path

from .views import PlatformStatusView

urlpatterns = [
    path("", PlatformStatusView.as_view(), name="platform-status"),
]
