"""
Resolves which tenant a request belongs to, before AuthenticationMiddleware
runs (auth needs the tenant's own `accounts.User` table already selected —
see MIDDLEWARE ordering in config/settings/base.py).

Two resolution paths, in order:
1. An explicit `X-Tenant-Slug` header. This is the primary mechanism for
   local development, tests, and any deployment fronted by something that
   already knows the tenant (e.g. a reverse proxy translating a custom
   domain to a header) — real wildcard-subdomain DNS isn't available in
   every environment this code runs in.
2. The request's Host subdomain, against `settings.PLATFORM_ROOT_DOMAINS`
   (e.g. "acme.vansales.app" with root domain "vansales.app" resolves to
   slug "acme"). This is the production mechanism, and needs wildcard DNS
   + a wildcard TLS cert at the hosting layer to actually reach this code
   with the right Host header — infrastructure this codebase can't
   provision itself.

Critical distinction — a request only ever gets switched onto the
platform/control URL namespace (apps/tenancy/platform_urls.py) when there
is *positive* evidence it's a platform-level request: an explicit
X-Tenant-Slug that didn't resolve, or a Host that matches a configured
platform root domain (bare, or as a subdomain) with no matching tenant.
Absent any of that signal at all — no header, PLATFORM_ROOT_DOMAINS unset
or not matched — the request falls straight through to the normal app
urlconf, unchanged. That's not a gap; it's what keeps every existing
single-tenant deployment, and the entire existing test suite, working
exactly as it did before this file existed: apps.tenancy.db_router's
fallback-to-"default" then makes the data layer behave identically too.
"""
from django.conf import settings
from django.core.exceptions import DisallowedHost

from .models import Tenant
from .routing import activate_tenant, deactivate_tenant


class TenantResolutionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant, is_platform_request = self._resolve(request)
        request.tenant = tenant
        if tenant is not None:
            activate_tenant(tenant)
        else:
            deactivate_tenant()
            if is_platform_request:
                # Positive evidence this belongs to the platform/control
                # namespace, not just "we couldn't figure out a tenant" —
                # see module docstring. Setting request.urlconf here
                # (before get_response) is Django's documented mechanism
                # for a per-request URLconf override.
                request.urlconf = "apps.tenancy.platform_urls"
        try:
            response = self.get_response(request)
        finally:
            deactivate_tenant()
        return response

    def _resolve(self, request):
        header_slug = request.headers.get("X-Tenant-Slug", "").strip().lower()
        if header_slug:
            tenant = Tenant.objects.filter(slug=header_slug, is_active=True).first()
            # An explicit slug that doesn't resolve is a platform-level
            # concern (e.g. "no such tenant"), not a fall-through to the
            # normal app.
            return tenant, True

        root_domains = getattr(settings, "PLATFORM_ROOT_DOMAINS", [])
        if not root_domains:
            # The overwhelmingly common case (every single-tenant/local-dev
            # deployment, and every non-Host-routed internal call — e.g.
            # admin-web's server-to-server calls to the "backend" container
            # hostname, which ALLOWED_HOSTS was never meant to cover).
            # Skip request.get_host() entirely rather than pay Django's
            # ALLOWED_HOSTS validation for a lookup we won't use anyway.
            return None, False

        try:
            host = request.get_host().split(":")[0].lower()
        except DisallowedHost:
            # A Host header ALLOWED_HOSTS doesn't recognize is not this
            # middleware's concern to enforce — that's a job for Django's
            # own host validation wherever it actually matters (CSRF,
            # absolute-URI building, ...). Fall through to the normal app
            # exactly like "no tenant signal at all".
            return None, False

        for root_domain in root_domains:
            if host == root_domain:
                return None, True  # the platform's own bare root domain
            suffix = f".{root_domain}"
            if host.endswith(suffix):
                slug = host[: -len(suffix)]
                tenant = Tenant.objects.filter(slug=slug, is_active=True).first()
                return tenant, True

        # No tenant signal whatsoever — the existing single-tenant/
        # local-dev/test mode. Fall through to the normal app.
        return None, False
