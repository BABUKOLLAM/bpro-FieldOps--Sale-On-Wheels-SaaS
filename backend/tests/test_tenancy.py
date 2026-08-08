import pytest
from django.db import connections
from django.test import RequestFactory

from apps.customers.models import Customer
from apps.tenancy.middleware import TenantResolutionMiddleware
from apps.tenancy.models import PlatformAdmin, Tenant
from apps.tenancy.routing import (
    activate_tenant, deactivate_tenant, get_current_tenant_alias, set_current_tenant_alias,
)


@pytest.fixture(autouse=True)
def _reset_tenant_context():
    """Every test starts and ends with no tenant context set, regardless
    of what a previous test (or a failure mid-test) left behind."""
    deactivate_tenant()
    yield
    deactivate_tenant()


# ---- The core safety property: cross-tenant query isolation ----


@pytest.mark.django_db(databases=["default", "tenant_test_a", "tenant_test_b"])
def test_customer_created_in_one_tenant_is_invisible_from_another():
    set_current_tenant_alias("tenant_test_a")
    Customer.objects.create(code="ONLY-IN-A", name="Tenant A's Customer", credit_limit=0, credit_days=0)

    set_current_tenant_alias("tenant_test_b")
    assert Customer.objects.filter(code="ONLY-IN-A").count() == 0
    assert not Customer.objects.exists()

    set_current_tenant_alias("tenant_test_a")
    assert Customer.objects.filter(code="ONLY-IN-A").exists()


@pytest.mark.django_db(databases=["default", "tenant_test_a", "tenant_test_b"])
def test_customer_created_directly_on_each_alias_stays_separate():
    Customer.objects.using("tenant_test_a").create(
        code="DIRECT-A", name="Direct A", credit_limit=0, credit_days=0,
    )
    Customer.objects.using("tenant_test_b").create(
        code="DIRECT-B", name="Direct B", credit_limit=0, credit_days=0,
    )

    set_current_tenant_alias("tenant_test_a")
    codes = set(Customer.objects.values_list("code", flat=True))
    assert codes == {"DIRECT-A"}

    set_current_tenant_alias("tenant_test_b")
    codes = set(Customer.objects.values_list("code", flat=True))
    assert codes == {"DIRECT-B"}


@pytest.mark.django_db
def test_no_tenant_context_falls_back_to_default():
    """The router's fallback that keeps every pre-existing test/local-dev
    flow working unchanged — no tenant context set at all routes
    non-tenancy models to "default", exactly as before this feature."""
    assert get_current_tenant_alias() is None
    Customer.objects.create(code="NO-CONTEXT", name="Default DB Customer", credit_limit=0, credit_days=0)
    assert Customer.objects.using("default").filter(code="NO-CONTEXT").exists()


@pytest.mark.django_db(databases=["default", "tenant_test_a"])
def test_tenancy_models_always_route_to_default_even_with_a_tenant_active():
    set_current_tenant_alias("tenant_test_a")
    tenant = Tenant.objects.create(
        slug="router-check", name="Router Check", db_name="x", db_host="x", db_user="x",
    )
    # Written to "default" (the control DB) regardless of the active
    # tenant context, per apps.tenancy.db_router.TENANCY_APP_LABEL rule —
    # confirmed two ways: it's readable back via the *current* (tenant_test_a)
    # context despite never having been routed there, and it's directly
    # visible on "default" itself. (There's no tenancy_tenant table on
    # tenant_test_a at all — allow_migrate blocks it there, exactly as it
    # should for a real tenant database — so a `.using("tenant_test_a")`
    # query isn't a meaningful assertion to make here.)
    assert Tenant.objects.filter(pk=tenant.pk).exists()
    assert Tenant.objects.using("default").filter(pk=tenant.pk).exists()


# ---- activate_tenant() dynamic registration ----


@pytest.mark.django_db
def test_activate_tenant_registers_connection_and_sets_context():
    tenant = Tenant(
        slug="dynamic-check", name="Dynamic Check",
        db_name="some_db", db_host="some_host", db_port=5433, db_user="some_user",
    )
    tenant.db_password = "s3cret"

    alias = activate_tenant(tenant)

    assert alias == "tenant_dynamic-check"
    assert get_current_tenant_alias() == alias
    assert alias in connections.databases
    registered = connections.databases[alias]
    assert registered["NAME"] == "some_db"
    assert registered["HOST"] == "some_host"
    assert registered["PORT"] == 5433
    assert registered["PASSWORD"] == "s3cret"

    # Idempotent: calling again for the same tenant doesn't clobber or
    # duplicate the registration.
    activate_tenant(tenant)
    assert len({k for k in connections.databases if k == alias}) == 1


@pytest.mark.django_db
def test_deactivate_tenant_clears_context_without_removing_registration():
    tenant = Tenant(
        slug="deactivate-check", name="Deactivate Check",
        db_name="x", db_host="x", db_user="x",
    )
    alias = activate_tenant(tenant)
    deactivate_tenant()

    assert get_current_tenant_alias() is None
    # The connection registration itself is cheap to keep around — only
    # the "which tenant is current" context is cleared.
    assert alias in connections.databases


# ---- Tenant model ----


@pytest.mark.django_db
def test_tenant_db_password_round_trips_through_encryption():
    tenant = Tenant(slug="creds-check", name="Creds Check", db_name="x", db_host="x", db_user="x")
    tenant.db_password = "hunter2"
    tenant.save()

    tenant.refresh_from_db()
    assert tenant.db_password == "hunter2"
    # Never stored in plaintext.
    assert "hunter2" not in tenant._db_password_encrypted


@pytest.mark.django_db
def test_tenant_connection_alias_is_derived_from_slug():
    tenant = Tenant(slug="acme", name="Acme", db_name="x", db_host="x", db_user="x")
    assert tenant.connection_alias == "tenant_acme"


# ---- PlatformAdmin ----


@pytest.mark.django_db
def test_platform_admin_create_and_check_password():
    admin = PlatformAdmin.objects.create_platform_admin("ops@vansales.internal", "correct-horse")
    assert admin.check_password("correct-horse")
    assert not admin.check_password("wrong-password")


@pytest.mark.django_db
def test_platform_admin_requires_email():
    with pytest.raises(ValueError, match="email"):
        PlatformAdmin.objects.create_platform_admin("", "password")


# ---- TenantResolutionMiddleware ----


@pytest.mark.django_db
def test_middleware_falls_through_with_no_tenant_signal():
    request = RequestFactory().get("/", HTTP_HOST="testserver")
    middleware = TenantResolutionMiddleware(lambda r: r)
    tenant, is_platform_request = middleware._resolve(request)
    assert tenant is None
    assert is_platform_request is False


@pytest.mark.django_db
def test_middleware_resolves_via_explicit_header():
    Tenant.objects.create(slug="header-tenant", name="Header Tenant", db_name="x", db_host="x", db_user="x")
    request = RequestFactory().get("/", HTTP_HOST="testserver", HTTP_X_TENANT_SLUG="header-tenant")
    middleware = TenantResolutionMiddleware(lambda r: r)
    tenant, is_platform_request = middleware._resolve(request)
    assert tenant is not None
    assert tenant.slug == "header-tenant"
    assert is_platform_request is True


@pytest.mark.django_db
def test_middleware_unresolved_header_slug_is_a_platform_request():
    request = RequestFactory().get("/", HTTP_HOST="testserver", HTTP_X_TENANT_SLUG="no-such-tenant")
    middleware = TenantResolutionMiddleware(lambda r: r)
    tenant, is_platform_request = middleware._resolve(request)
    assert tenant is None
    assert is_platform_request is True


@pytest.mark.django_db
def test_middleware_resolves_subdomain_against_platform_root_domains(settings):
    settings.PLATFORM_ROOT_DOMAINS = ["vansales.test"]
    settings.ALLOWED_HOSTS = ["acme.vansales.test"]
    Tenant.objects.create(slug="acme", name="Acme", db_name="x", db_host="x", db_user="x")

    request = RequestFactory().get("/", HTTP_HOST="acme.vansales.test")
    middleware = TenantResolutionMiddleware(lambda r: r)
    tenant, is_platform_request = middleware._resolve(request)
    assert tenant is not None
    assert tenant.slug == "acme"
    assert is_platform_request is True


@pytest.mark.django_db
def test_middleware_bare_platform_root_domain_is_a_platform_request(settings):
    settings.PLATFORM_ROOT_DOMAINS = ["vansales.test"]
    settings.ALLOWED_HOSTS = ["vansales.test"]
    request = RequestFactory().get("/", HTTP_HOST="vansales.test")
    middleware = TenantResolutionMiddleware(lambda r: r)
    tenant, is_platform_request = middleware._resolve(request)
    assert tenant is None
    assert is_platform_request is True


@pytest.mark.django_db
def test_middleware_never_raises_disallowedhost_with_no_root_domains_configured(settings):
    """Regression: with PLATFORM_ROOT_DOMAINS unset (every single-tenant/
    local-dev deployment, and every container-to-container call using an
    internal Docker hostname like "backend:8000"), the middleware must
    never call request.get_host() at all — doing so previously raised
    DisallowedHost and broke admin-web's entire server-side call path."""
    settings.PLATFORM_ROOT_DOMAINS = []
    settings.ALLOWED_HOSTS = ["localhost", "127.0.0.1"]  # deliberately excludes "backend"
    request = RequestFactory().get("/", HTTP_HOST="backend:8000")
    middleware = TenantResolutionMiddleware(lambda r: r)
    tenant, is_platform_request = middleware._resolve(request)
    assert tenant is None
    assert is_platform_request is False


@pytest.mark.django_db
def test_middleware_falls_through_on_disallowed_host_even_with_root_domains_configured(settings):
    settings.PLATFORM_ROOT_DOMAINS = ["vansales.test"]
    settings.ALLOWED_HOSTS = ["localhost"]  # deliberately excludes "backend"
    request = RequestFactory().get("/", HTTP_HOST="backend:8000")
    middleware = TenantResolutionMiddleware(lambda r: r)
    tenant, is_platform_request = middleware._resolve(request)
    assert tenant is None
    assert is_platform_request is False


@pytest.mark.django_db
def test_middleware_full_dispatch_sets_urlconf_only_for_platform_requests():
    seen = {}

    def get_response(request):
        seen["urlconf"] = getattr(request, "urlconf", None)
        seen["tenant"] = request.tenant
        return "ok"

    middleware = TenantResolutionMiddleware(get_response)

    # No signal at all -> normal app, no urlconf override.
    middleware(RequestFactory().get("/", HTTP_HOST="testserver"))
    assert seen["urlconf"] is None
    assert seen["tenant"] is None

    # Unresolved explicit slug -> platform namespace.
    middleware(RequestFactory().get("/", HTTP_HOST="testserver", HTTP_X_TENANT_SLUG="ghost"))
    assert seen["urlconf"] == "apps.tenancy.platform_urls"
    assert seen["tenant"] is None
