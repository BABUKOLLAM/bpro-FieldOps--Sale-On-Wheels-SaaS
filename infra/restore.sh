#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_FILE="${1:-}"
RESTORE_DB="${RESTORE_DB:-}"

if [[ -z "$BACKUP_FILE" || -z "$RESTORE_DB" || "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo "Usage: CONFIRM_RESTORE=YES RESTORE_DB=<empty-test-db> ./restore.sh <backup.sql.gz>" >&2
  exit 1
fi
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi
gzip -t "$BACKUP_FILE"

cd "$(dirname "$0")"
set -a
source .env
set +a

echo "Restoring $BACKUP_FILE into existing database $RESTORE_DB"
gzip -dc "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres psql \
  -U "${POSTGRES_USER}" -d "$RESTORE_DB" -v ON_ERROR_STOP=1

echo "Restore completed successfully."
