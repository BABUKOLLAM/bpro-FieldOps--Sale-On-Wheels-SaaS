#!/usr/bin/env bash
# Boots the backend for the Playwright E2E suite (admin-web/e2e/):
# recreates a dedicated database from scratch, migrates it, seeds the
# default roles plus one known admin account, then serves on the port
# Playwright's webServer config expects. Never touches the dev DB —
# config.settings.e2e pins its own database name.
#
# Invoked by admin-web/playwright.config.ts; can also be run by hand
# for local debugging of the E2E stack.
set -euo pipefail
cd "$(dirname "$0")/.."

export DJANGO_SETTINGS_MODULE=config.settings.e2e
PORT="${E2E_BACKEND_PORT:-8100}"
DB_NAME="${POSTGRES_DB:-vansales_e2e}"

PYTHON="python"
[ -x .venv/bin/python ] && PYTHON=".venv/bin/python"

echo "==> Recreating $DB_NAME"
$PYTHON - << PYEOF
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
conn = psycopg2.connect(
    host=os.environ.get("POSTGRES_HOST", "localhost"),
    port=os.environ.get("POSTGRES_PORT", "5432"),
    user=os.environ.get("POSTGRES_USER", "vansales"),
    password=os.environ.get("POSTGRES_PASSWORD", "vansales"),
    dbname="postgres",
)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
with conn.cursor() as cur:
    cur.execute('DROP DATABASE IF EXISTS "$DB_NAME" WITH (FORCE)')
    cur.execute('CREATE DATABASE "$DB_NAME"')
conn.close()
print("database $DB_NAME recreated")
PYEOF

echo "==> Migrating + seeding"
$PYTHON manage.py migrate --noinput
$PYTHON manage.py shell -c "
from apps.accounts.models import Role, User, UserRole
from apps.accounts.constants import ROLE_SUPER_ADMIN
Role.seed_defaults()
# Idempotent: the DB is normally freshly recreated above, but a warm
# re-run (or a lingering connection that blocked the drop) must not
# crash the whole E2E boot on a duplicate-username insert.
admin, created = User.objects.get_or_create(
    username='e2e-admin@test.local',
    defaults=dict(email='e2e-admin@test.local', is_staff=True, is_superuser=True),
)
admin.set_password('E2e#Admin#Pass1')
admin.save()
UserRole.objects.get_or_create(user=admin, role=Role.objects.get(name=ROLE_SUPER_ADMIN))
print('seeded roles + e2e-admin@test.local (created=%s)' % created)
"

echo "==> Serving on :$PORT"
exec $PYTHON manage.py runserver "0.0.0.0:$PORT" --noreload
