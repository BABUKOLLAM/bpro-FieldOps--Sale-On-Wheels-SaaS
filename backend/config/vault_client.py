"""
Lightweight Vault client helper used by Django settings to fetch secrets
at startup when VAULT_ADDR and VAULT_TOKEN are provided in the environment.

This implementation is intentionally dependency-free: it uses urllib from
stdlib so the settings file can safely import it during test runs and CI
without requiring hvac.

Behavior:
- If VAULT_ADDR and VAULT_TOKEN are not set, get_secret() returns None.
- Assumes KV v2 by default (/v1/secret/data/<path>). Set VAULT_KV_V2=0 to
  use KV v1 (/v1/secret/<path>).
- Secrets for a given key are expected to be stored as a map; this helper
  tries to return the 'value' field if present, otherwise a field named
  the same as the secret key, otherwise the first value in the map.

Note: For production we recommend using AppRole or a short-lived token
retrieval mechanism rather than embedding a long-lived root token in env.
"""
import json
import os
import urllib.request
import urllib.error

VAULT_ADDR = os.environ.get("VAULT_ADDR")
VAULT_TOKEN = os.environ.get("VAULT_TOKEN")
# If set to "0" treat as KV v1; otherwise KV v2 (/v1/secret/data/<path>)
VAULT_KV_V2 = os.environ.get("VAULT_KV_V2", "1") != "0"
# Optional prefix under which secrets are stored (without the /v1/ part)
VAULT_SECRET_PREFIX = os.environ.get("VAULT_SECRET_PREFIX", "secret/data") if VAULT_KV_V2 else os.environ.get("VAULT_SECRET_PREFIX", "secret")


def _vault_get(path: str) -> dict | None:
    if not VAULT_ADDR or not VAULT_TOKEN:
        return None
    url = VAULT_ADDR.rstrip("/") + "/v1/" + path.lstrip("/")
    req = urllib.request.Request(url, method="GET")
    req.add_header("X-Vault-Token", VAULT_TOKEN)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        # Treat not found or permission issues as missing secret
        return None
    except Exception:
        # Be conservative: any network error should not crash settings import
        return None


def get_secret(key: str, default: str | None = None) -> str | None:
    """Return the secret value for key, or default if not present.

    For KV v2 the API returns {data: {data: {...}}}. For KV v1 it's {data: {...}}.
    This helper tries both shapes and extracts a sensible scalar value.
    """
    if not VAULT_ADDR or not VAULT_TOKEN:
        return default

    # Build path (e.g. secret/data/SECRET_KEY or secret/SECRET_KEY)
    vault_path = f"{VAULT_SECRET_PREFIX.rstrip('/')}/{key}"

    body = _vault_get(vault_path)
    if not body:
        return default

    # KV v2: body.get('data', {}).get('data')
    data = None
    if isinstance(body, dict) and "data" in body:
        maybe = body["data"]
        if isinstance(maybe, dict) and "data" in maybe:
            data = maybe["data"]
        elif isinstance(maybe, dict):
            data = maybe
    if data is None and isinstance(body, dict):
        # fallback: maybe body itself is the map
        data = body

    if not isinstance(data, dict):
        return default

    # Common patterns: {'value': '...'}, or {'SECRET_KEY':'...'}, or multiple
    if "value" in data and isinstance(data["value"], str):
        return data["value"]
    if key in data and isinstance(data[key], str):
        return data[key]

    # Otherwise return first string value found
    for v in data.values():
        if isinstance(v, str):
            return v

    return default
