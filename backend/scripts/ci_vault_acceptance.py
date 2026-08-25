"""CI acceptance script: verify Django loads secrets from Vault in CI.

This script is used only by the CI job that starts a Vault dev server and
populates SECRET_KEY and FIELD_ENCRYPTION_KEY. The script performs a
minimal Django startup and asserts SECRET_KEY equals the expected CI value.
"""
import os
import sys

# Expected value set by the CI step that populates Vault in the workflow
EXPECTED_SECRET = os.environ.get("CI_EXPECTED_SECRET", "dummy-secret")

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")

try:
    import django
    from django.conf import settings
except Exception as exc:
    print("ERROR: could not import Django; is the venv activated?", exc)
    sys.exit(2)

try:
    django.setup()
    secret = getattr(settings, "SECRET_KEY", None)
    if not secret:
        print("ERROR: SECRET_KEY is empty or missing in settings")
        sys.exit(3)
    print("SECRET_KEY loaded from settings: ", secret)
    if secret != EXPECTED_SECRET:
        print(f"ERROR: SECRET_KEY does not match expected CI value ('{EXPECTED_SECRET}')")
        sys.exit(4)
    print("Vault acceptance: SECRET_KEY matches expected CI value — OK.")
    sys.exit(0)
except Exception as exc:
    print("ERROR during Django setup / secret check:", exc)
    sys.exit(5)
