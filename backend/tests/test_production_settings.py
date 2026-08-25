"""config.settings.production must refuse to start on missing/insecure
secrets — validated by actually importing the settings module in a
subprocess with a controlled environment, exactly the way a container
would boot with a bad .env."""
import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent

# A syntactically valid Fernet key for cases where the encryption key
# itself isn't the thing under test.
VALID_FERNET_KEY = "b142MqNTXKs46wWNs1s02ZIpPmFWhoAAy6P1Hy4AMxU="


def _boot_production_settings(extra_env):
    """Imports config.settings.production in a clean subprocess and
    returns (returncode, stderr)."""
    env = {
        "PATH": os.environ["PATH"],
        "DJANGO_SETTINGS_MODULE": "config.settings.production",
        # Neutralize any developer .env the settings loader would read.
        "SENTRY_DSN": "",
        **extra_env,
    }
    result = subprocess.run(
        [sys.executable, "-c", "import config.settings.production"],
        cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=60,
    )
    return result.returncode, result.stderr


def test_boots_cleanly_with_real_secrets():
    code, stderr = _boot_production_settings({
        "SECRET_KEY": "a-real-production-secret-key-value",
        "FIELD_ENCRYPTION_KEY": VALID_FERNET_KEY,
        "FRONTEND_BASE_URL": "https://app.company.com",
        "ALLOWED_HOSTS": "app.company.com,api.company.com",
        "CORS_ALLOWED_ORIGINS": "https://app.company.com",
    })
    assert code == 0, stderr


def test_refuses_default_secret_key():
    code, stderr = _boot_production_settings({
        "SECRET_KEY": "django-insecure-dev-only-change-me",
        "FIELD_ENCRYPTION_KEY": VALID_FERNET_KEY,
    })
    assert code != 0
    assert "SECRET_KEY" in stderr


def test_refuses_missing_encryption_key():
    code, stderr = _boot_production_settings({
        "SECRET_KEY": "a-real-production-secret-key-value",
        "FIELD_ENCRYPTION_KEY": "",
    })
    assert code != 0
    assert "FIELD_ENCRYPTION_KEY" in stderr


def test_refuses_invalid_encryption_key():
    code, stderr = _boot_production_settings({
        "SECRET_KEY": "a-real-production-secret-key-value",
        "FIELD_ENCRYPTION_KEY": "not-a-valid-fernet-key",
    })
    assert code != 0
    assert "FIELD_ENCRYPTION_KEY" in stderr


def test_refuses_localhost_frontend_in_production():
    code, stderr = _boot_production_settings({
        "SECRET_KEY": "a-real-production-secret-key-value",
        "FIELD_ENCRYPTION_KEY": VALID_FERNET_KEY,
        "FRONTEND_BASE_URL": "http://localhost:3000",
        "ALLOWED_HOSTS": "localhost,127.0.0.1",
    })
    assert code != 0
    assert "FRONTEND_BASE_URL" in stderr or "ALLOWED_HOSTS" in stderr or "localhost" in stderr.lower()


def test_refuses_default_example_domain_in_production():
    code, stderr = _boot_production_settings({
        "SECRET_KEY": "a-real-production-secret-key-value",
        "FIELD_ENCRYPTION_KEY": VALID_FERNET_KEY,
        "FRONTEND_BASE_URL": "https://example.com",
        "CORS_ALLOWED_ORIGINS": "https://example.com",
        "ALLOWED_HOSTS": "example.com,api.example.com",
    })
    assert code != 0
    assert "example.com" in stderr.lower() or "production" in stderr.lower()
