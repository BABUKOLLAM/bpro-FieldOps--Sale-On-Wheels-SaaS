"""
Per-request tenant selection. A contextvar rather than a bare thread-local
— safe under async views/tasks, where a thread can interleave requests
for different tenants, unlike a thread-local which would leak between
them.

`activate_tenant()` is the only place a tenant database connection gets
registered — called once per request by TenantResolutionMiddleware (see
apps/tenancy/middleware.py), and directly in tests/management commands
that need to address one tenant's database outside a request.
"""
from contextvars import ContextVar

from django.db import connections

from .models import Tenant

_current_tenant_alias: ContextVar[str | None] = ContextVar("current_tenant_alias", default=None)


def get_current_tenant_alias() -> str | None:
    return _current_tenant_alias.get()


def set_current_tenant_alias(alias: str | None) -> None:
    _current_tenant_alias.set(alias)


def activate_tenant(tenant: Tenant) -> str:
    """Registers `tenant`'s database connection (if not already present)
    and makes it the current tenant for this context. Returns the alias.
    Registration is idempotent — safe to call on every request without
    re-adding the same connection."""
    alias = tenant.connection_alias
    if alias not in connections.databases:
        connections.databases[alias] = {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": tenant.db_name,
            "USER": tenant.db_user,
            "PASSWORD": tenant.db_password,
            "HOST": tenant.db_host,
            "PORT": tenant.db_port,
            "ATOMIC_REQUESTS": False,
            "CONN_HEALTH_CHECKS": False,
            "CONN_MAX_AGE": 0,
            "AUTOCOMMIT": True,
            "OPTIONS": {},
            "TIME_ZONE": None,
            "TEST": {"NAME": None, "MIRROR": None, "DEPENDENCIES": ["default"]},
        }
    set_current_tenant_alias(alias)
    return alias


def deactivate_tenant() -> None:
    """Clears the current-tenant context — called at the end of a request
    (or a `with tenant_context(...)` block) so a later request/task on the
    same worker never accidentally inherits the wrong tenant."""
    set_current_tenant_alias(None)
