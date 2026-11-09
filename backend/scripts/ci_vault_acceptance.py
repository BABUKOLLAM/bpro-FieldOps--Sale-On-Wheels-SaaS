"""CI acceptance script: verify Django loads secrets from Vault in CI.

This script is used only by the CI job that starts a Vault dev server and
populates SECRET_KEY and FIELD_ENCRYPTION_KEY. The script performs a
minimal Django startup and asserts SECRET_KEY equals the expected CI value.
"""
import os
import sys
from pathlib import Path

# Run as `python scripts/ci_vault_acceptance.py` (the CI step's working
# directory is backend/), Python puts scripts/ on sys.path, not backend/,
# so `config.settings` was unimportable ("No module named 'config'") and
# this check failed on every push. Put the Django project root first,
# whatever the caller's working directory.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

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
    # Never echo the secret itself into CI logs — only whether it matched.
    print(f"SECRET_KEY loaded from settings ({len(secret)} chars).")
    if secret != EXPECTED_SECRET:
        print(f"ERROR: SECRET_KEY does not match expected CI value ('{EXPECTED_SECRET}')")
        sys.exit(4)
    print("Vault acceptance: SECRET_KEY matches expected CI value — OK.")
    sys.exit(0)
except Exception as exc:
    print("ERROR during Django setup / secret check:", exc)
    sys.exit(5)
