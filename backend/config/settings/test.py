from .base import *  # noqa: F401,F403

DEBUG = False

# Run Celery tasks synchronously in tests — no Redis/worker required, and
# failures raise immediately instead of vanishing into a broker no test
# process is consuming.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# In-process cache for tests, same reason as eager Celery above — the
# base settings point the cache (which backs DRF throttle counters) at
# Redis, and tests must run with no Redis available.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

FIELD_ENCRYPTION_KEY = "b142MqNTXKs46wWNs1s02ZIpPmFWhoAAy6P1Hy4AMxU="

# Two extra, statically-declared database aliases purely for testing
# apps.tenancy's DB router (tests/test_tenancy.py) — pytest-django's
# multi-db test support needs every alias it'll touch to already exist in
# DATABASES before the test session starts, so it can create/tear down a
# test database per alias the normal way. Real tenant databases are never
# declared statically like this — apps.tenancy.routing.activate_tenant()
# registers them dynamically at runtime instead (see its own test in
# tests/test_tenancy.py for that mechanism specifically).
for _alias in ("tenant_test_a", "tenant_test_b"):
    DATABASES[_alias] = {**DATABASES["default"], "NAME": f"{DATABASES['default']['NAME']}_{_alias}"}
