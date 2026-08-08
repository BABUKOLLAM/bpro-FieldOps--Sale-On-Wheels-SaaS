import json

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

# Shared by every model that stores third-party credentials at rest
# (apps.integrations.ERPConnection, apps.payments.PaymentGatewayConnection,
# apps.tenancy.Tenant) — extracted rather than left duplicated a third time.


def _fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "FIELD_ENCRYPTION_KEY is not set — required to store encrypted credentials. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_json(value: dict) -> str:
    return _fernet().encrypt(json.dumps(value).encode()).decode()


def decrypt_json(value: str) -> dict:
    if not value:
        return {}
    try:
        return json.loads(_fernet().decrypt(value.encode()).decode())
    except InvalidToken:
        return {}
