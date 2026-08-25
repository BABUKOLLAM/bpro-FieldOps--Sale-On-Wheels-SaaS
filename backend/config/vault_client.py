"""
Vault client helper used by Django settings to fetch secrets.

This module prefers the official hvac client when available (installed via
requirements). hvac is used in CI and production for a more robust
integration. When hvac is not available (e.g., a lightweight local dev
environment before dependencies are installed) the implementation falls
back to a dependency-free urllib-based reader so importing settings
remains safe during test collection.

Behavior:
- If VAULT_ADDR and VAULT_TOKEN are not set, get_secret() returns None.
- Assumes KV v2 by default (/v1/secret/data/<path>). Set VAULT_KV_V2=0 to
  use KV v1 (/v1/secret/<path>).
- Secrets for a given key are expected to be stored as a map; this helper
  tries to return the 'value' field if present, otherwise a field named
  the same as the secret key, otherwise the first value in the map.
"""
from __future__ import annotations

import json
import os
from typing import Optional

VAULT_ADDR = os.environ.get("VAULT_ADDR")
VAULT_TOKEN = os.environ.get("VAULT_TOKEN")
# If set to "0" treat as KV v1; otherwise KV v2 (/v1/secret/data/<path>)
VAULT_KV_V2 = os.environ.get("VAULT_KV_V2", "1") != "0"
VAULT_SECRET_PREFIX = os.environ.get(
    "VAULT_SECRET_PREFIX", "secret/data" if VAULT_KV_V2 else "secret"
)


def _extract_value_from_map(data: dict, key: str) -> Optional[str]:
    if not isinstance(data, dict):
        return None
    if "value" in data and isinstance(data["value"], str):
        return data["value"]
    if key in data and isinstance(data[key], str):
        return data[key]
    for v in data.values():
        if isinstance(v, str):
            return v
    return None


# Try to import hvac; fall back to urllib implementation if missing so
# settings import remains safe in environments where dependencies aren't
# installed yet (local dev, some CI phases).
try:
    import hvac  # type: ignore

    def get_secret(key: str, default: Optional[str] = None) -> Optional[str]:
        if not VAULT_ADDR or not VAULT_TOKEN:
            return default
        try:
            client = hvac.Client(url=VAULT_ADDR, token=VAULT_TOKEN, timeout=10)
            if not client.is_authenticated():
                return default
            if VAULT_KV_V2:
                # path should be without the /v1 prefix for hvac's v2 API
                path = f"{VAULT_SECRET_PREFIX.rstrip('/')}/{key}"
                # hvac expects the path after the mount point; if the prefix
                # contains 'data' (e.g. 'secret/data'), we need to strip it
                # to get the mount point and the path below it.
                if path.startswith("secret/data/"):
                    mount_point = "secret"
                    secret_path = path.split("secret/data/", 1)[1]
                else:
                    # generic handling: split at first '/'
                    parts = path.split("/", 1)
                    mount_point = parts[0]
                    secret_path = parts[1] if len(parts) > 1 else key
                resp = client.secrets.kv.v2.read_secret_version(
                    path=secret_path, mount_point=mount_point
                )
                data = resp.get("data", {}).get("data")
                return _extract_value_from_map(data or {}, key) or default
            else:
                # KV v1
                path = f"{VAULT_SECRET_PREFIX.rstrip('/')}/{key}"
                resp = client.secrets.kv.v1.read_secret(path=path)
                data = resp.get("data")
                return _extract_value_from_map(data or {}, key) or default
        except Exception:
            # Do not raise during settings import; return default so
            # environments without Vault can continue to run.
            return default

except Exception:
    # Fallback implementation using urllib (kept from the original
    # lightweight helper). This keeps settings import safe when hvac isn't
    # installed yet.
    import urllib.request
    import urllib.error

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
        except urllib.error.HTTPError:
            return None
        except Exception:
            return None

    def get_secret(key: str, default: Optional[str] = None) -> Optional[str]:
        if not VAULT_ADDR or not VAULT_TOKEN:
            return default

        vault_path = f"{VAULT_SECRET_PREFIX.rstrip('/')}/{key}"
        body = _vault_get(vault_path)
        if not body:
            return default

        data = None
        if isinstance(body, dict) and "data" in body:
            maybe = body["data"]
            if isinstance(maybe, dict) and "data" in maybe:
                data = maybe["data"]
            elif isinstance(maybe, dict):
                data = maybe
        if data is None and isinstance(body, dict):
            data = body

        if not isinstance(data, dict):
            return default

        return _extract_value_from_map(data, key) or default
