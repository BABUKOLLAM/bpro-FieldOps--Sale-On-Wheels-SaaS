from .base import *  # noqa: F401,F403

DEBUG = False

# Run Celery tasks synchronously in tests — no Redis/worker required, and
# failures raise immediately instead of vanishing into a broker no test
# process is consuming.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

FIELD_ENCRYPTION_KEY = "b142MqNTXKs46wWNs1s02ZIpPmFWhoAAy6P1Hy4AMxU="
