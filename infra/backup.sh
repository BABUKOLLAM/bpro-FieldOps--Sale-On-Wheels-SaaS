#!/usr/bin/env bash
# Nightly Postgres backup — gzipped dump, keeps the last $RETENTION_DAYS
# locally. Add to the host's crontab, e.g.:
#   0 2 * * * /path/to/vansales-saas/infra/backup.sh >> /var/log/vansales-backup.log 2>&1
#
# For off-box backups (recommended once the client has real data), pipe
# the same dump to an S3-compatible bucket (e.g. Cloudflare R2) with
# rclone or `aws s3 cp` — see the commented example at the bottom.
set -euo pipefail

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP=$(date +%Y%m%d-%H%M%S)

# Reads POSTGRES_USER/POSTGRES_DB from .env (lives next to
# docker-compose.prod.yml in production — see docs/DEPLOYMENT.md).
set -a
source .env
set +a

mkdir -p "$BACKUP_DIR"

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip > "$BACKUP_DIR/vansales-$STAMP.sql.gz"

find "$BACKUP_DIR" -name "vansales-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

echo "Backup complete: $BACKUP_DIR/vansales-$STAMP.sql.gz"

# Off-box copy example (uncomment and configure once you have an R2/S3
# bucket + credentials):
# rclone copy "$BACKUP_DIR/vansales-$STAMP.sql.gz" r2:vansales-backups/
