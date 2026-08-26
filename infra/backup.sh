#!/usr/bin/env bash
# Nightly Postgres backup — gzipped dump, keeps the last $RETENTION_DAYS
# locally. Add to the host's crontab, e.g.:
#   0 2 * * * /path/to/vansales-saas/infra/backup.sh >> /var/log/vansales-backup.log 2>&1
#
# For off-box backups, set BACKUP_REMOTE to an rclone `crypt` remote. The
# crypt remote encrypts filenames and file contents before Google Drive sees
# them; never upload the plain BACKUP_DIR directly to cloud storage.
set -euo pipefail

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_REMOTE="${BACKUP_REMOTE:-}"
BACKUP_WEBHOOK_URL="${BACKUP_WEBHOOK_URL:-}"
# Match whichever compose file this deployment actually runs (the
# caddy-fronted VPS uses docker-compose.prod.caddy-fronted.yml). Both
# files share the same Compose project/service names, so exec resolves
# the same postgres container either way — but say what we mean.
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
STAMP=$(date +%Y%m%d-%H%M%S)

notify_backup() {
  local result="${1:-unknown}"
  if [[ -z "$BACKUP_WEBHOOK_URL" ]]; then
    return 0
  fi
  curl -fsS --max-time 10 -X POST "$BACKUP_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    --data "{\"status\":\"$result\",\"backup\":\"vansales-$STAMP.sql.gz\"}" \
    >/dev/null || echo "Warning: backup notification failed." >&2
}

trap 'backup_exit_code=$?; if [[ $backup_exit_code -ne 0 ]]; then notify_backup failure; fi; exit "$backup_exit_code"' EXIT

# Reads POSTGRES_USER/POSTGRES_DB from .env (lives next to
# docker-compose.prod.yml in production — see docs/DEPLOYMENT.md).
set -a
source .env
set +a

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/vansales-$STAMP.sql.gz"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip > "$BACKUP_FILE"

gzip -t "$BACKUP_FILE"

if [[ -n "$BACKUP_REMOTE" ]]; then
  command -v rclone >/dev/null 2>&1 || { echo "BACKUP_REMOTE requires rclone to be installed." >&2; exit 1; }
  rclone copy "$BACKUP_FILE" "$BACKUP_REMOTE"
fi

find "$BACKUP_DIR" -name "vansales-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

echo "Backup complete: $BACKUP_FILE"
notify_backup success

# Example after configuring a crypt remote:
# BACKUP_REMOTE=gdrive-fieldops: rclone copy "$BACKUP_FILE" gdrive-fieldops:
