"""Settings for the local/CI end-to-end (Playwright) stack — a real
Django server that admin-web's E2E suite drives through a real browser
(see admin-web/e2e/). Differences from dev are exactly the ones that
make E2E runs deterministic and self-contained:

- dedicated database (vansales_e2e unless POSTGRES_DB overrides) so a
  run never touches a developer's working data;
- in-process cache: throttle counters and connector nonces don't leak
  between runs via a shared Redis;
- generous throttle rates: the suite performs many rapid logins from
  one IP by design — production's 10/min anti-brute-force rate would
  fail the run for the wrong reason (rates stay finite so throttling
  itself stays exercised);
- eager Celery + console email, same rationale as test.py.
"""
from .base import *  # noqa: F401,F403
from .base import DATABASES, REST_FRAMEWORK, env

DEBUG = True

DATABASES["default"]["NAME"] = env("POSTGRES_DB", default="vansales_e2e")

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {
        "anon": "600/min",
        "user": "6000/min",
        "login": "100/min",
        "signup_request": "100/min",
    },
}

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
