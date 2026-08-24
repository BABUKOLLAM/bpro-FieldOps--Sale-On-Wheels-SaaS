# Operations runbook

Day-2 operations for a live deployment: deploying, rolling back,
backups, and diagnosing the failure modes this stack has actually
exhibited in production. First-time setup lives in
[DEPLOYMENT.md](DEPLOYMENT.md); this doc assumes the stack is already
running.

All commands run on the VPS unless noted. `infra/` means
`/opt/vansales-saas/infra` on the current production box.

## Deploying a release

One command — never the manual pull/build/up/restart sequence, every
step of which has caused a real incident when missed (see
[Known failure modes](#known-failure-modes)):

```bash
cd /opt/vansales-saas/infra && ./deploy.sh
```

`deploy.sh` does, in order: preflight-checks that `infra/.env` has real
(non-placeholder) `SECRET_KEY` / `FIELD_ENCRYPTION_KEY` /
`POSTGRES_PASSWORD` (the backend *refuses to boot* on placeholders —
see `config/settings/production.py`), fast-forwards to `origin/main`,
rebuilds backend + admin-web images, recreates **all** services (so
celery workers pick up the new backend image too), restarts both
proxies (project nginx + shared Caddy), then verifies the backend
container stays up and the public URLs return 200 before declaring
success. On any failure it prints the backend logs and the exact
rollback command.

Migrations run automatically on backend start (the container's
`command:` runs `migrate` before gunicorn) — no manual migration step.

## Rolling back

Every successful deploy prints its own rollback command; it is just:

```bash
cd /opt/vansales-saas/infra && ./deploy.sh <previous-commit>
```

That redeploys the older code through the exact same build/verify
pipeline. A later `./deploy.sh` (no argument) returns to latest
`origin/main`.

**The database is the caveat.** Rolling back code does NOT reverse
migrations that already ran. This is normally fine — see the migration
safety rules below, which exist precisely so old code can run against a
newer schema. Before rolling back across a release that included
migrations, check what ran:

```bash
docker compose -f docker-compose.prod.caddy-fronted.yml exec backend \
  python manage.py showmigrations | grep -A 3 '\[X\]' | tail -20
```

If a migration in the rolled-back range was destructive (dropped or
renamed a column/table the old code reads), a plain code rollback will
crash — restore the pre-deploy database backup instead (below), and
treat that migration as a process failure per the rules.

### Migration safety rules

- **Additive first.** New columns nullable or defaulted; new tables and
  indexes freely. Old code must be able to run against the new schema —
  that's what makes code-only rollback safe.
- **Destructive changes ship one release later.** Dropping/renaming a
  column is only allowed after a release in which nothing reads it has
  been deployed and verified.
- CI already fails on model changes without migrations
  (`makemigrations --check` in `backend-ci.yml`).

## Backups

`infra/backup.sh` — gzipped nightly `pg_dump`, 14-day local retention
(cron setup in DEPLOYMENT.md §8). On the caddy-fronted VPS run it as:

```bash
COMPOSE_FILE=docker-compose.prod.caddy-fronted.yml ./backup.sh
```

Off-box copies (rclone to R2/S3) are the commented example at the
bottom of the script — configure once real client data exists.

### Restore test (do this quarterly — an untested backup is a hope, not a backup)

Restores the latest dump into a **scratch database inside the same
Postgres container**, sanity-checks it, and drops it. Never touches the
live `vansales` database:

```bash
cd /opt/vansales-saas/infra
LATEST=$(ls -t backups/vansales-*.sql.gz | head -1) && echo "testing $LATEST"

docker compose -f docker-compose.prod.caddy-fronted.yml exec -T postgres \
  psql -U vansales -d postgres -c 'DROP DATABASE IF EXISTS restore_test' \
  -c 'CREATE DATABASE restore_test'

gunzip -c "$LATEST" | docker compose -f docker-compose.prod.caddy-fronted.yml exec -T postgres \
  psql -q -U vansales -d restore_test

# Sanity: row counts for a few tables that must never be empty in prod.
docker compose -f docker-compose.prod.caddy-fronted.yml exec -T postgres \
  psql -U vansales -d restore_test -c \
  "SELECT 'users' t, count(*) FROM accounts_user
   UNION ALL SELECT 'roles', count(*) FROM accounts_role"

docker compose -f docker-compose.prod.caddy-fronted.yml exec -T postgres \
  psql -U vansales -d postgres -c 'DROP DATABASE restore_test'
```

Record the date and result somewhere the team sees. A real restore
(overwriting live data after an incident) is the same `gunzip | psql`
against the real DB name — with the stack stopped
(`docker compose ... stop backend celery-worker celery-beat`) and only
ever from a dump you have restore-tested this way.

## Health and monitoring

| What | How |
|---|---|
| Backend liveness | `https://api.fieldopspro.in/healthz/` → 200 (also used by deploy.sh and the compose healthcheck) |
| Console liveness | `https://fieldopspro.in/` → 200 |
| Container states | `docker compose -f docker-compose.prod.caddy-fronted.yml ps` — anything `Restarting`/`Exited` is an incident |
| Error tracking | Sentry is fully wired (API + celery) but **dormant until `SENTRY_DSN` is set** in `infra/.env`. Creating a free Sentry project and setting that one variable turns on real alerting — the single highest-value monitoring step still open. |
| Dependency CVEs | CI fails on new advisories (`pip-audit` in backend-ci, `npm audit --audit-level=high` in admin-web-ci) |
| Logs | `docker compose -f docker-compose.prod.caddy-fronted.yml logs <service> --tail 100` — `backend`, `admin-web`, `celery-worker`, `nginx` |

## Known failure modes

Every entry below happened in production at least once. `deploy.sh`
exists to make the first three impossible to hit by forgetting a step.

| Symptom | Cause | Fix |
|---|---|---|
| Site serves old code after "deploying" | `up -d` recreates containers from the **last built** image; without `build` first, nothing changed | Always deploy via `deploy.sh` (it always builds) |
| New backend code live, but celery tasks run old code | `up -d backend admin-web` with named services leaves celery-worker/beat on the old image | `deploy.sh` runs `up -d` with no service list |
| 502 Bad Gateway on some/all domains right after a deploy | nginx resolves each upstream container IP once at startup; a recreated container gets a new IP | `docker restart infra-nginx-1` (deploy.sh does it); same for `deploy-caddy-1` if only `api.` or only the app domains are affected |
| Caddy logs `config is unchanged` after editing the Caddyfile | `sed -i`/editors replace the file by rename → new inode; the container's single-file bind mount still reads the old one | `docker restart deploy-caddy-1` re-resolves the mount |
| Backend container exits immediately after a deploy | Startup secret validation: `SECRET_KEY`/`FIELD_ENCRYPTION_KEY` blank or placeholder in `infra/.env` | The container log names the exact variable; fix `.env`, `up -d backend` |
| Browser shows an unstyled/broken page while curl shows the site fine | Stale service-worker cache from a previous build (`admin-web/public/sw.js`) | Close and reopen the tab/window, or DevTools → Application → Service Workers → Unregister + Clear site data |
| A domain 308-redirects to itself for a few seconds after a proxy restart | Shared Caddy re-establishing upstream connections | Self-resolves in seconds; only investigate if it persists past ~30s |
