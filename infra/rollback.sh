#!/usr/bin/env bash
set -euo pipefail

# Generic rollback helper for a dedicated VPS deployment.
# It expects the last known-good git revision or image tag and then
# redeploys the previous state.

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
TARGET_REF="${1:-}"

if [[ -z "$TARGET_REF" ]]; then
  echo "Usage: ./rollback.sh <git-ref-or-tag>"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing .env file for production deployment."
  exit 1
fi

if git rev-parse --verify "$TARGET_REF" >/dev/null 2>&1; then
  echo "==> Checking out $TARGET_REF"
  git checkout "$TARGET_REF"
else
  echo "==> Using provided ref as git reference: $TARGET_REF"
fi

echo "==> Rebuilding and restarting services"
docker compose --env-file .env -f "$COMPOSE_FILE" build backend admin-web

docker compose --env-file .env -f "$COMPOSE_FILE" up -d --force-recreate

./healthcheck.sh

if [[ -n "${DEPLOY_WEBHOOK_URL:-}" ]]; then
  curl -fsS --max-time 10 -X POST "$DEPLOY_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    --data "{\"status\":\"rollback_succeeded\",\"ref\":$(printf '%s' "$TARGET_REF" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}" \
    >/dev/null || echo "Warning: rollback notification failed." >&2
fi

echo "Rollback complete."
