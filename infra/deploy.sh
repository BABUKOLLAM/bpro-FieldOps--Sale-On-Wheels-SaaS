#!/usr/bin/env bash
# Formalized production deploy — one command instead of five manual
# steps, each of which has already caused a real incident: an un-rebuilt
# image serving old code, celery workers left on a stale image, nginx
# holding a dead upstream IP (502s), Caddy pinned to a stale connection.
#
# Usage:
#   ./deploy.sh                 # deploy latest origin/main
#   ./deploy.sh <git-ref>       # deploy (or ROLL BACK to) any commit/tag
#
# Environment overrides (defaults fit the current fieldopspro.in VPS):
#   COMPOSE_FILE   compose file to use   (docker-compose.prod.caddy-fronted.yml)
#   PROJECT_NGINX  project nginx container to restart (infra-nginx-1)
#   SHARED_CADDY   shared front-door container to restart (deploy-caddy-1;
#                  set empty to skip, e.g. on a non-Caddy deployment)
#   APP_URL        public URL that must return 200 after deploy (https://fieldopspro.in/)
#   API_URL        API health URL that must return 200 (https://api.fieldopspro.in/healthz/)
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.caddy-fronted.yml}"
PROJECT_NGINX="${PROJECT_NGINX:-infra-nginx-1}"
SHARED_CADDY="${SHARED_CADDY:-deploy-caddy-1}"
APP_URL="${APP_URL:-https://fieldopspro.in/}"
API_URL="${API_URL:-https://api.fieldopspro.in/healthz/}"
REF="${1:-origin/main}"

cd "$(dirname "$0")"
INFRA_DIR=$(pwd)
cd ..

say()  { printf '\n==> %s\n' "$*"; }
fail() { printf '\nDEPLOY FAILED: %s\n' "$*" >&2; exit 1; }

# ---- 1. Preflight: secrets that would stop the backend from booting ----
# config/settings/production.py refuses placeholder/blank SECRET_KEY and
# FIELD_ENCRYPTION_KEY at startup — catch that here, before we take the
# stack down, not after.
say "Preflight: checking $INFRA_DIR/.env secrets"
[ -f "$INFRA_DIR/.env" ] || fail "$INFRA_DIR/.env not found."
for var in SECRET_KEY FIELD_ENCRYPTION_KEY POSTGRES_PASSWORD; do
    value=$(grep -E "^${var}=" "$INFRA_DIR/.env" | tail -1 | cut -d= -f2- || true)
    case "$value" in
        ""|change-me*) fail "$var in infra/.env is blank or a placeholder — fix it first." ;;
    esac
done
echo "    secrets look real."

# ---- 1b. Vault preflight: if Vault is configured, ensure it's reachable and usable
if [ -n "${VAULT_ADDR:-}" ]; then
    say "Preflight: Vault detected at $VAULT_ADDR — validating token and connectivity"

    # If a token isn't supplied directly, try AppRole exchange when role/secret are present
    if [ -z "${VAULT_TOKEN:-}" ]; then
        if [ -n "${VAULT_ROLE_ID:-}" ] && [ -n "${VAULT_SECRET_ID:-}" ]; then
            say "No VAULT_TOKEN provided; attempting AppRole login with VAULT_ROLE_ID/VAULT_SECRET_ID"
            # Use python to parse the JSON response so we don't depend on jq
            token_json=$(curl -s -X POST -d "{\"role_id\":\"$VAULT_ROLE_ID\",\"secret_id\":\"$VAULT_SECRET_ID\"}" "$VAULT_ADDR/v1/auth/approle/login" || true)
            VAULT_TOKEN=$(python - <<PY
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('auth', {}).get('client_token', ''))
except Exception:
    sys.exit(1)
PY
<<<"$token_json") || true
            if [ -z "${VAULT_TOKEN:-}" ]; then
                fail "AppRole exchange did not yield a token. Check VAULT_ROLE_ID/VAULT_SECRET_ID or Vault AppRole configuration."
            fi
            say "AppRole login succeeded; token acquired (will be used for preflight checks)."
        else
            fail "VAULT_ADDR is set but VAULT_TOKEN is not provided. Provide a short-lived token or supply VAULT_ROLE_ID and VAULT_SECRET_ID for AppRole exchange."
        fi
    fi

    # If Vault Agent is being used (sidecar/agent injection) it may expose a local address
    if [ -n "${VAULT_AGENT_ADDR:-}" ]; then
        say "Vault Agent detected at $VAULT_AGENT_ADDR — validating agent connectivity"
        agent_status=$(curl -s -o /dev/null -w '%{http_code}' "$VAULT_AGENT_ADDR/v1/sys/health" || echo 000)
        if [ "$agent_status" != "200" ] && [ "$agent_status" != "429" ]; then
            fail "Vault Agent at $VAULT_AGENT_ADDR not responding as expected (HTTP $agent_status)."
        fi
        # Prefer agent address for secret reads if present
        VAULT_ADDR="$VAULT_AGENT_ADDR"
        say "Using Vault Agent address for subsequent checks ($VAULT_ADDR)."
    fi

    # Attempt a lightweight GET for a critical secret path (KV v2 default)
    VAULT_SECRET_PATH="/v1/secret/data/SECRET_KEY"
    status=$(curl -s -o /dev/null -w '%{http_code}' -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR$VAULT_SECRET_PATH" || echo 000)
    case "$status" in
        200|404)
            echo "    Vault reachable (status $status)."
            ;;
        *)
            fail "Vault did not respond as expected (HTTP $status). Check VAULT_ADDR/VAULT_TOKEN and Vault health."
            ;;
    esac
fi

# ---- 2. Check out the requested code ----
say "Fetching and checking out $REF"
git fetch origin
OLD_COMMIT=$(git rev-parse --short HEAD)
if [ "$REF" = "origin/main" ]; then
    git checkout -q main
    git merge --ff-only origin/main
else
    # A specific ref = a pinned deploy or a rollback. Detached HEAD is
    # deliberate: the next plain ./deploy.sh returns to origin/main.
    git checkout -q --detach "$REF"
fi
NEW_COMMIT=$(git rev-parse --short HEAD)
echo "    $OLD_COMMIT -> $NEW_COMMIT ($(git log -1 --format=%s))"

# ---- 3. Build ----
say "Building backend + admin-web images"
cd "$INFRA_DIR"
docker compose -f "$COMPOSE_FILE" build backend admin-web

# ---- 4. Recreate EVERY service on the new images ----
# No service list on purpose: celery-worker and celery-beat run the
# backend image too — 'up -d backend admin-web' leaves them on the old
# image, silently running stale task code.
say "Recreating containers"
docker compose -f "$COMPOSE_FILE" up -d

# ---- 5. Restart the proxies ----
# nginx resolves each upstream's container IP once, at startup — after a
# recreate it points at a dead IP and serves 502s until restarted. The
# shared Caddy has shown the same stale-connection behavior.
say "Restarting proxies"
docker restart "$PROJECT_NGINX"
if [ -n "$SHARED_CADDY" ]; then
    docker restart "$SHARED_CADDY" || echo "    (warning: could not restart $SHARED_CADDY — check it manually)"
fi

# ---- 6. Verify: the backend actually booted... ----
say "Verifying backend boot"
sleep 5
if docker compose -f "$COMPOSE_FILE" ps backend | grep -qiE 'restarting|exited'; then
    docker compose -f "$COMPOSE_FILE" logs backend --tail 40
    fail "backend container is not staying up — logs above. Roll back with: ./deploy.sh $OLD_COMMIT"
fi

# ---- 7. ...and the public URLs answer ----
say "Verifying public endpoints (up to 90s)"
for url in "$API_URL" "$APP_URL"; do
    ok=""
    for _ in $(seq 1 18); do
        status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)
        if [ "$status" = "200" ]; then ok=1; break; fi
        sleep 5
    done
    if [ -n "$ok" ]; then
        echo "    $url -> 200"
    else
        docker compose -f "$COMPOSE_FILE" logs backend --tail 30
        fail "$url did not return 200 (last status: ${status:-none}). Roll back with: ./deploy.sh $OLD_COMMIT"
    fi
done

say "Deploy complete: $NEW_COMMIT is live. Roll back anytime with: ./deploy.sh $OLD_COMMIT"
