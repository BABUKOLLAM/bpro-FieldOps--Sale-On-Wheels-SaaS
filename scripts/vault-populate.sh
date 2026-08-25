#!/usr/bin/env bash
# Simple helper to populate a development Vault instance with example
# secrets for local testing. This script assumes the `vault` CLI is
# available and the caller is already authenticated (or uses a root
# dev token for local dev).

set -euo pipefail

if [ -z "${VAULT_ADDR:-}" ]; then
  echo "Please set VAULT_ADDR (e.g. export VAULT_ADDR=http://127.0.0.1:8200)"
  exit 2
fi
if [ -z "${VAULT_TOKEN:-}" ]; then
  echo "Please set VAULT_TOKEN (e.g. export VAULT_TOKEN=root)"
  exit 2
fi

# KV v2 path helper
kv_put() {
  local key=$1
  local value=$2
  # use the HTTP API to avoid requiring a particular client
  curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" -d "{ \"data\": { \"value\": \"$value\" } }" "$VAULT_ADDR/v1/secret/data/$key" >/dev/null
}

echo "Populating Vault at $VAULT_ADDR with example secrets (KV v2 path: secret/data/<key>)"
kv_put SECRET_KEY "$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')"
kv_put FIELD_ENCRYPTION_KEY "$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
kv_put POSTGRES_PASSWORD "password-for-prod-db"
kv_put CONNECTOR_API_KEY "connector-api-key-prod"

cat <<EOF
Done. Example secrets written to Vault.
Example secrets:
  SECRET_KEY
  FIELD_ENCRYPTION_KEY
  POSTGRES_PASSWORD
  CONNECTOR_API_KEY

You can now run the app with VAULT_ADDR and VAULT_TOKEN set to access these values.
EOF
