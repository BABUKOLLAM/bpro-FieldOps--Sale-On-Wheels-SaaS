from cryptography.fernet import Fernet
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# ---- Fail fast on missing/insecure secrets ----
# The dev-convenience defaults in base.py must never survive into a
# production process: a known SECRET_KEY forges sessions/JWTs, and a
# blank/invalid FIELD_ENCRYPTION_KEY either crashes on first credential
# write (late, mid-request) or silently returns {} on decrypt. Raising
# ImproperlyConfigured here stops the container at startup — before it
# serves a single request — with a message naming the exact variable.
_INSECURE_SECRET_KEY_DEFAULT = "django-insecure-dev-only-change-me"
if not SECRET_KEY or SECRET_KEY == _INSECURE_SECRET_KEY_DEFAULT:  # noqa: F405
    raise ImproperlyConfigured(
        "SECRET_KEY must be set to a real secret in production (it is unset or still the "
        "dev default). Generate one: python -c \"import secrets; print(secrets.token_urlsafe(50))\""
    )
if not FIELD_ENCRYPTION_KEY:  # noqa: F405
    raise ImproperlyConfigured(
        "FIELD_ENCRYPTION_KEY must be set in production — required to store encrypted "
        "credentials (ERP connections, payment gateways, tenant DB passwords). Generate one: "
        "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )
try:
    Fernet(FIELD_ENCRYPTION_KEY.encode() if isinstance(FIELD_ENCRYPTION_KEY, str) else FIELD_ENCRYPTION_KEY)  # noqa: F405
except (ValueError, TypeError) as exc:
    raise ImproperlyConfigured(
        f"FIELD_ENCRYPTION_KEY is not a valid Fernet key ({exc}). Generate one: "
        "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    ) from exc

SECURE_SSL_REDIRECT = True
# Container-internal healthchecks (docker-compose healthcheck, nginx
# upstream probes) hit plain http://localhost:8000/healthz/ — without
# these, the SSL redirect would 301 them and ALLOWED_HOSTS (set from env
# to the public domain) would 400 them.
SECURE_REDIRECT_EXEMPT = [r"^healthz/$"]
for _host in ("localhost", "127.0.0.1"):
    if _host not in ALLOWED_HOSTS:  # noqa: F405
        ALLOWED_HOSTS.append(_host)  # noqa: F405
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
    )
