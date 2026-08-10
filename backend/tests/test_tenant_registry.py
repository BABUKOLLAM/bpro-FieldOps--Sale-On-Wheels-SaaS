"""Self-service tenant registry: PlatformAdmin login/JWT auth (a control-
plane identity separate from apps.accounts.User), slug validation, the
provisioning API's permission boundary, and one real end-to-end
provisioning run (creates a genuine Postgres database, migrates it,
seeds roles, then drops it — same infrastructure the already-verified
provision_tenant management command uses)."""

import psycopg2
import pytest
from django.conf import settings
from django.db import connections
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Role, User
from apps.tenancy.auth import tokens_for_platform_admin
from apps.tenancy.models import PlatformAdmin, Tenant
from apps.tenancy.provisioning import ProvisioningError, provision_tenant, validate_slug
from apps.tenancy.routing import deactivate_tenant, set_current_tenant_alias

PLATFORM_HEADER = {"HTTP_X_TENANT_SLUG": "no-such-tenant-routes-to-platform"}


@pytest.fixture(autouse=True)
def _reset_tenant_context():
    deactivate_tenant()
    yield
    deactivate_tenant()


@pytest.fixture
def platform_admin(db):
    return PlatformAdmin.objects.create_platform_admin(email="root@platform.test", password="rootpass123")


def _drop_tenant_database(db_name: str):
    control = settings.DATABASES["default"]
    alias = f"tenant_{db_name.removeprefix('vansales_tenant_')}"
    if alias in connections.databases:
        connections[alias].close()
    conn = psycopg2.connect(
        host=control["HOST"], port=control["PORT"], user=control["USER"], password=control["PASSWORD"],
        dbname=control["NAME"],
    )
    conn.autocommit = True
    try:
        with conn.cursor() as cursor:
            cursor.execute(f'DROP DATABASE IF EXISTS "{db_name}"')
    finally:
        conn.close()


# ---- slug validation ----


@pytest.mark.django_db
def test_validate_slug_rejects_bad_format():
    with pytest.raises(ProvisioningError):
        validate_slug("Not_A_Slug!")
    with pytest.raises(ProvisioningError):
        validate_slug("a")  # too short


@pytest.mark.django_db
def test_validate_slug_rejects_reserved_word():
    with pytest.raises(ProvisioningError):
        validate_slug("admin")


@pytest.mark.django_db
def test_validate_slug_rejects_existing_tenant():
    Tenant.objects.create(slug="acme", name="Acme", db_name="x", db_host="x", db_user="x")
    with pytest.raises(ProvisioningError):
        validate_slug("acme")


# ---- PlatformAdmin login ----


@pytest.mark.django_db
def test_platform_login_wrong_password_rejected(platform_admin):
    client = APIClient()
    response = client.post(
        "/auth/login/", {"email": platform_admin.email, "password": "wrong"}, format="json", **PLATFORM_HEADER,
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_platform_login_issues_tokens(platform_admin):
    client = APIClient()
    response = client.post(
        "/auth/login/", {"email": platform_admin.email, "password": "rootpass123"}, format="json", **PLATFORM_HEADER,
    )
    assert response.status_code == 200, response.data
    assert "access" in response.data
    assert "refresh" in response.data


# ---- permission boundary ----


@pytest.mark.django_db
def test_tenant_list_requires_authentication():
    client = APIClient()
    response = client.get("/tenants/", **PLATFORM_HEADER)
    assert response.status_code == 401


@pytest.mark.django_db
def test_regular_accounts_user_token_is_rejected_on_platform_namespace():
    """A plain accounts.User JWT (no 'platform_admin' claim) must never
    be accepted here — the whole point of the separate claim/identity."""
    Role.seed_defaults()
    user = User.objects.create_user(username="regular@test.local", password="testpass123")
    token = RefreshToken.for_user(user)  # no platform_admin claim

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    response = client.get("/tenants/", **PLATFORM_HEADER)
    assert response.status_code == 401


@pytest.mark.django_db
def test_tenant_list_authenticated_platform_admin_succeeds(platform_admin):
    tokens = tokens_for_platform_admin(platform_admin)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    response = client.get("/tenants/", **PLATFORM_HEADER)
    assert response.status_code == 200


@pytest.mark.django_db
def test_provision_rejects_invalid_slug_via_api(platform_admin):
    tokens = tokens_for_platform_admin(platform_admin)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    response = client.post("/tenants/", {"slug": "admin", "name": "x"}, format="json", **PLATFORM_HEADER)
    assert response.status_code == 400
    assert not Tenant.objects.filter(slug="admin").exists()


@pytest.mark.django_db
def test_provision_request_cannot_smuggle_db_connection_fields(platform_admin):
    """Even if a caller sends db_host/db_password etc, the view's
    ProvisionTenantSerializer only ever reads slug/name — proves the
    self-service surface can't be used to point a tenant at an arbitrary
    external database."""
    from apps.tenancy.serializers import ProvisionTenantSerializer

    serializer = ProvisionTenantSerializer(data={
        "slug": "whatever", "name": "Whatever Inc",
        "db_host": "evil.example.com", "db_password": "hunter2",
    })
    assert serializer.is_valid(), serializer.errors
    assert set(serializer.validated_data.keys()) == {"slug", "name"}


# ---- real end-to-end provisioning ----


@pytest.mark.django_db
def test_provision_tenant_end_to_end_via_api(platform_admin):
    tokens = tokens_for_platform_admin(platform_admin)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    db_name = "vansales_tenant_pytestreg"
    try:
        response = client.post(
            "/tenants/", {"slug": "pytestreg", "name": "Pytest Registry Co"}, format="json", **PLATFORM_HEADER,
        )
        assert response.status_code == 201, response.data
        assert response.data["slug"] == "pytestreg"

        tenant = Tenant.objects.get(slug="pytestreg")
        assert tenant.db_name == db_name
        assert tenant.db_password  # encrypted, but set

        # The new database is real and was actually migrated + seeded.
        set_current_tenant_alias(tenant.connection_alias)
        from apps.tenancy.routing import activate_tenant

        activate_tenant(tenant)
        assert Role.objects.using(tenant.connection_alias).filter(name="van_salesman").exists()
    finally:
        deactivate_tenant()
        _drop_tenant_database(db_name)


@pytest.mark.django_db
def test_provision_tenant_duplicate_slug_returns_400(platform_admin):
    tokens = tokens_for_platform_admin(platform_admin)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    db_name = "vansales_tenant_pytestdupe"
    try:
        first = client.post(
            "/tenants/", {"slug": "pytestdupe", "name": "First"}, format="json", **PLATFORM_HEADER,
        )
        assert first.status_code == 201, first.data

        second = client.post(
            "/tenants/", {"slug": "pytestdupe", "name": "Second"}, format="json", **PLATFORM_HEADER,
        )
        assert second.status_code == 400
        assert Tenant.objects.filter(slug="pytestdupe").count() == 1
    finally:
        deactivate_tenant()
        _drop_tenant_database(db_name)
