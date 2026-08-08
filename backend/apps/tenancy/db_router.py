"""
DATABASE_ROUTERS entry (see config/settings/base.py). Two rules:

1. apps.tenancy's own models (Tenant, PlatformAdmin) always live in the
   control-plane database ("default") — they're the registry, not tenant
   data.
2. Every other app's models route to whichever tenant database is
   "current" for this request/context (apps.tenancy.routing), falling
   back to "default" when no tenant context has been set at all.

That fallback is deliberate, not a gap: it's what keeps the existing
94-test suite and local single-DB dev setup working completely unchanged
— with no TenantResolutionMiddleware in the loop (e.g. every test written
before this migration, or `docker compose exec backend python manage.py
shell`), everything simply behaves exactly as it always has, reading and
writing "default" as if it were the only database in the world.
"""
from .routing import get_current_tenant_alias

TENANCY_APP_LABEL = "tenancy"


class TenancyRouter:
    def _route(self, model, **hints):
        if model._meta.app_label == TENANCY_APP_LABEL:
            return "default"
        return get_current_tenant_alias() or "default"

    def db_for_read(self, model, **hints):
        return self._route(model, **hints)

    def db_for_write(self, model, **hints):
        return self._route(model, **hints)

    def allow_relation(self, obj1, obj2, **hints):
        # Both control-plane models, or both tenant models on the same
        # (implicitly, "current") database — either way Django's default
        # same-db check is correct. Returning None defers to it rather
        # than hardcoding a comparison that would be wrong for one side.
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == TENANCY_APP_LABEL:
            return db == "default"
        # Every other app is allowed to migrate onto "default" (the
        # existing single-DB dev/test setup) or any tenant_* alias
        # (a real provisioned tenant) — it's the same schema either way.
        return True
