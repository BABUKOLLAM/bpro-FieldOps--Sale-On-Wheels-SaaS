#!/usr/bin/env bash
set -euo pipefail
trap 'deploy_exit_code=$?; if [[ $deploy_exit_code -ne 0 ]]; then notify_deploy failure; fi; exit "$deploy_exit_code"' EXIT

# Generic production deploy for a dedicated VPS or VM.
# This script is provider-neutral: it does not assume Hostinger or any
# other specific cloud provider. It expects a real production .env file
# with real domains and secrets.
#
# Usage:
#   ./deploy-generic.sh
#   APP_DOMAIN=app.example.com API_DOMAIN=api.example.com ./deploy-generic.sh
#
# Typical flow:
#   1) Prepare infra/.env from infra/.env.production.template
#   2) Set the DNS records for APP_DOMAIN and API_DOMAIN to this server
#   3) Run this script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_DOMAIN="${APP_DOMAIN:-${APP_URL:-}}"
API_DOMAIN="${API_DOMAIN:-${API_URL:-}}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-fieldops-prod}"
COMPOSE_NETWORK_NAME="${COMPOSE_NETWORK_NAME:-fieldops-prod-network}"
export COMPOSE_PROJECT_NAME COMPOSE_NETWORK_NAME

notify_deploy() {
  local result="${1:-unknown}"
  if [[ -z "${DEPLOY_WEBHOOK_URL:-}" ]]; then
    return 0
  fi
  curl -fsS --max-time 10 -X POST "$DEPLOY_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    --data "{\"status\":\"$result\",\"image_tag\":$(printf '%s' "$IMAGE_TAG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}" \
    >/dev/null || echo "Warning: deployment notification failed." >&2
}

if [[ -z "$APP_DOMAIN" || -z "$API_DOMAIN" ]]; then
  echo "APP_DOMAIN and API_DOMAIN are required. Example:"
  echo "  APP_DOMAIN=app.example.com API_DOMAIN=api.example.com ./deploy-generic.sh"
  exit 1
fi

if [[ "$COMPOSE_FILE" != "docker-compose.prod.yml" ]]; then
  echo "Exclusive deployment requires docker-compose.prod.yml; shared-front-door topologies are not permitted." >&2
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "Missing production env file: $SCRIPT_DIR/.env"
  echo "Create one from infra/.env.production.template before deploying."
  exit 1
fi

python3 "$SCRIPT_DIR/../backend/scripts/check_production_env.py" --env-file "$SCRIPT_DIR/.env"

existing_nginx="$(docker compose --env-file .env -f "$COMPOSE_FILE" ps -q nginx 2>/dev/null || true)"
if [[ -z "$existing_nginx" ]]; then
  for port in 80 443; do
    if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "Host port $port is already in use. Stop or move the conflicting service before deploying this exclusive stack." >&2
      exit 1
    fi
  done
fi

# Hard-fail on obvious unsafe prod settings
for key in SECRET_KEY FIELD_ENCRYPTION_KEY POSTGRES_PASSWORD; do
  value="$(grep -E "^${key}=" "$SCRIPT_DIR/.env" | tail -1 | cut -d= -f2- || true)"
  if [[ -z "$value" || "$value" == *"change-me"* || "$value" == *"example.com"* || "$value" == "localhost" ]]; then
    echo "Production env is not ready: $key is missing or still set to a placeholder value."
    exit 1
  fi
done

if grep -Eq '^ALLOWED_HOSTS=.*localhost|^CORS_ALLOWED_ORIGINS=.*localhost|^FRONTEND_BASE_URL=.*localhost|^NEXT_PUBLIC_API_BASE_URL=.*localhost' "$SCRIPT_DIR/.env"; then
  echo "Production env contains localhost values. Replace them with the real domains."
  exit 1
fi

if grep -Eq '^FRONTEND_BASE_URL=.*example\.com|^NEXT_PUBLIC_API_BASE_URL=.*example\.com|^ALLOWED_HOSTS=.*example\.com|^CORS_ALLOWED_ORIGINS=.*example\.com' "$SCRIPT_DIR/.env"; then
  echo "Production env still contains example.com placeholders. Replace them with your real domains."
  exit 1
fi

# Build the application stack using the configured env file.
echo "==> Building Docker images"
docker compose --env-file .env -f "$COMPOSE_FILE" build backend admin-web

echo "==> Starting application stack"
docker compose --env-file .env -f "$COMPOSE_FILE" up -d

echo "==> Waiting for backend healthcheck"
for _ in $(seq 1 30); do
  if curl -fsS "https://${API_DOMAIN}/healthz/" >/dev/null 2>&1; then
    echo "Backend health check passed on https://${API_DOMAIN}/healthz/"
    break
  fi
  sleep 5
  if [[ $_ -eq 30 ]]; then
    echo "Backend did not become healthy in time. Check logs:"
    docker compose --env-file .env -f "$COMPOSE_FILE" logs --tail 80 backend
    exit 1
  fi
done

echo "==> Waiting for frontend"
for _ in $(seq 1 30); do
  if curl -fsS "https://${APP_DOMAIN}/" >/dev/null 2>&1; then
    echo "Frontend check passed on https://${APP_DOMAIN}/"
    break
  fi
  sleep 5
  if [[ $_ -eq 30 ]]; then
    echo "Frontend did not become reachable in time. Check logs:"
    docker compose --env-file .env -f "$COMPOSE_FILE" logs --tail 80 admin-web nginx
    exit 1
  fi
done

echo "==> Deployment complete"
echo "API:   https://${API_DOMAIN}"
echo "Web:   https://${APP_DOMAIN}"
echo "Env:   $SCRIPT_DIR/.env"
notify_deploy success
