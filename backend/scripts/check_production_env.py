#!/usr/bin/env python3
"""Validate production-only deployment configuration.

This is intended for deployment gates and CI, and intentionally fails fast on
placeholder values, localhost, example.com, or obviously invalid production
URLs.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def fails(value: str | None) -> bool:
    if not value:
        return True
    lowered = value.lower()
    if any(token in lowered for token in ("localhost", "127.0.0.1", "example.com", "change-me", "replace-me", "yourdomain", "your-domain")):
        return True
    return False


def validate(env_values: dict[str, str]) -> list[str]:
    errors: list[str] = []
    required = [
        "SECRET_KEY",
        "FIELD_ENCRYPTION_KEY",
        "POSTGRES_PASSWORD",
        "ALLOWED_HOSTS",
        "FRONTEND_BASE_URL",
        "NEXT_PUBLIC_API_BASE_URL",
        "CORS_ALLOWED_ORIGINS",
    ]
    for key in required:
        value = env_values.get(key)
        if fails(value):
            errors.append(f"{key} must be set to a real production value and must not include localhost/example.com/default placeholders.")

    frontend = env_values.get("FRONTEND_BASE_URL", "")
    api = env_values.get("NEXT_PUBLIC_API_BASE_URL", "")
    if frontend and not re.match(r"^https://[A-Za-z0-9.-]+(:\d+)?/?$", frontend):
        errors.append("FRONTEND_BASE_URL must be a valid https URL.")
    if api and not re.match(r"^https://[A-Za-z0-9.-]+(:\d+)?/?$", api):
        errors.append("NEXT_PUBLIC_API_BASE_URL must be a valid https URL.")

    allowed_hosts = env_values.get("ALLOWED_HOSTS", "")
    if allowed_hosts:
        parts = [part.strip() for part in allowed_hosts.split(",") if part.strip()]
        for host in parts:
            if host.lower() in {"localhost", "127.0.0.1", "backend"}:
                continue
            if any(token in host.lower() for token in ("localhost", "example.com")):
                errors.append(f"ALLOWED_HOSTS includes an unsafe host: {host}")

    cors = env_values.get("CORS_ALLOWED_ORIGINS", "")
    if cors:
        origins = [origin.strip() for origin in cors.split(",") if origin.strip()]
        for origin in origins:
            if not origin.startswith("https://"):
                errors.append(f"CORS_ALLOWED_ORIGINS must be https-only in production: {origin}")
            if any(token in origin.lower() for token in ("localhost", "example.com")):
                errors.append(f"CORS_ALLOWED_ORIGINS includes an unsafe origin: {origin}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate production env variables.")
    parser.add_argument("--env-file", default="infra/.env", help="Path to the deployment environment file.")
    args = parser.parse_args()

    env_path = Path(args.env_file)
    if not env_path.exists():
        print(f"ERROR: env file not found: {env_path}", file=sys.stderr)
        return 2

    # Allow overriding with real environment variables and file values.
    env_values = {**read_env_file(env_path), **os.environ}
    errors = validate(env_values)
    if errors:
        print("Production configuration validation failed:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        return 1

    print("Production configuration validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
