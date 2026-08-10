"""URLconf used only for requests TenantResolutionMiddleware couldn't
resolve to a tenant — see apps/tenancy/middleware.py's request.urlconf
override. The Super Admin/PlatformAdmin control-plane surface: login and
the self-service tenant registry."""
from django.urls import path

from .views import PlatformLoginView, PlatformStatusView, TenantListCreateView

urlpatterns = [
    path("", PlatformStatusView.as_view(), name="platform-status"),
    path("auth/login/", PlatformLoginView.as_view(), name="platform-login"),
    path("tenants/", TenantListCreateView.as_view(), name="platform-tenants"),
]
