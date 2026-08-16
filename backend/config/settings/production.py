from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

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
