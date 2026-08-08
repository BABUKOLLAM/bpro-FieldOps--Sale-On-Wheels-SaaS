import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.hashers import make_password
from django.db import models

from apps.core.encryption import decrypt_json, encrypt_json
from apps.core.models import BaseModel


class Tenant(BaseModel):
    """One row per client, living only in the control-plane database (see
    apps.tenancy.db_router) — the registry apps.tenancy.routing reads to
    know which physical Postgres database to route a request's queries to.

    Multi-tenancy here is database-per-tenant with dynamic routing, not a
    shared schema: every other app's models are completely unchanged and
    stay scoped to whichever tenant's own database is "current" for the
    request — there is no tenant_id column anywhere else in the schema,
    and so no shared table for a missed filter to leak from. Adding a
    client is `provision_tenant <slug> <name>`, not a new Django
    deployment (see apps/tenancy/management/commands)."""

    slug = models.SlugField(
        max_length=63, unique=True, help_text="Subdomain this tenant is resolved by, e.g. 'acme' for acme.vansales.app.",
    )
    name = models.CharField(max_length=200)
    db_name = models.CharField(max_length=100)
    db_host = models.CharField(max_length=255)
    db_port = models.PositiveIntegerField(default=5432)
    db_user = models.CharField(max_length=100)
    _db_password_encrypted = models.TextField(blank=True, db_column="db_password_encrypted")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.slug})"

    @property
    def db_password(self) -> str:
        return decrypt_json(self._db_password_encrypted).get("password", "")

    @db_password.setter
    def db_password(self, value: str):
        self._db_password_encrypted = encrypt_json({"password": value})

    @property
    def connection_alias(self) -> str:
        """The alias this tenant's database is registered under in
        django.db.connections.databases once apps.tenancy.routing.
        activate_tenant() has run for it — derived from slug so it's
        stable and human-readable in logs/tracebacks."""
        return f"tenant_{self.slug}"


class PlatformAdminManager(BaseUserManager):
    def create_platform_admin(self, email: str, password: str, **extra_fields) -> "PlatformAdmin":
        if not email:
            raise ValueError("A platform admin requires an email.")
        admin = self.model(email=self.normalize_email(email), **extra_fields)
        admin.password = make_password(password)
        admin.save(using=self._db)
        return admin


class PlatformAdmin(AbstractBaseUser):
    """The Super Admin identity. Deliberately **not** a row in any
    tenant's own `apps.accounts.User` table — a Super Admin operates the
    control plane itself (provisioning clients, and from Phase 2 on,
    approving cross-tenant master-settings/role changes), they aren't "a
    user inside client X's org." Phase 1 only establishes this identity
    and its password-hashing plumbing; real session/JWT auth for it is
    Phase 2 scope, same as the rest of the approval workflow."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list = []

    objects = PlatformAdminManager()

    def __str__(self):
        return self.email
