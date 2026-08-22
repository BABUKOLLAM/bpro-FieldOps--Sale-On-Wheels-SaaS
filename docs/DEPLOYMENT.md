# Production deployment (single client)

A step-by-step handover runbook for putting this app live for one
client on their own domain and database — the "single-client" model
`docs/PROVISIONING.md` describes, not the multi-tenant SaaS path
`apps.tenancy` also supports (that needs wildcard DNS/SSL and is a
deliberately separate setup — see that app's middleware docstring if you
ever need it).

**Estimated cost**: ~$10–15/month VPS + ~$10–15/year domain. Everything
else below (SSL, backups-to-disk) is free.

**Convention**: every command below runs from inside `infra/`, and the
production `.env` lives there too (next to `docker-compose.prod.yml`) —
Docker Compose auto-discovers a `.env` in the directory you run it from,
so this avoids needing an `--env-file` flag on every command. This is
deliberately different from the dev `.env` (repo root, see
`.env.example`) — the two setups don't share a file.

## 0. What you need before starting

- A VPS with **Docker + Docker Compose v2** installed, root/sudo access,
  and at least 4GB RAM (this stack runs 7 containers: Postgres, Redis,
  Django, 2 Celery processes, Next.js, nginx). A Hostinger **KVM VPS**
  plan or a Hetzner **CX32** both work — plain shared/cPanel hosting
  does not (no Docker).
- A domain you control DNS for.
- This repo cloned onto the VPS (`git clone ... vansales-saas`).

## 1. DNS

Point four A records at the VPS's IP address:

```
app.fieldopspro.in   A   <vps-ip>   # admin-web — the back-office console
fieldopspro.in       A   <vps-ip>   # same console, bare/apex domain
www.fieldopspro.in   A   <vps-ip>   # same console, www
api.fieldopspro.in   A   <vps-ip>   # backend — hit directly by the mobile app
```

The apex record (`fieldopspro.in` with no subdomain — sometimes shown
as `@` in a DNS panel) and `www` both serve the identical admin-web
console as `app.` — see the nginx config's `server_name` line. No
wildcard record needed for this model — just these four.

## 2. Configure secrets

```bash
cd vansales-saas/infra
cp ../.env.production.example .env
```

Edit `infra/.env`: the domain values (`app.`/`api.fieldopspro.in`) are
already filled in; generate real values for `SECRET_KEY`, `POSTGRES_PASSWORD`,
`FIELD_ENCRYPTION_KEY`, and `CONNECTOR_API_KEY` (commands are inline as
comments in the file). Leave the email/FCM/SMS/Sentry vars blank for now
— every one of them safely falls back to console-logging instead of
faking success (see each var's comment).

All commands from here on assume you're inside `infra/`.

## 3. Bootstrap nginx (HTTP-only, so Certbot can reach it)

```bash
mkdir -p nginx
cp nginx/vansales.bootstrap.conf.example nginx/vansales.conf   # already carries fieldopspro.in

docker compose -f docker-compose.prod.yml up -d nginx
```

Visit `http://app.fieldopspro.in` — you should see the "nginx is up"
placeholder text. If not, fix DNS/firewall (port 80 open) before
continuing.

## 4. Issue the TLS certificate

One certificate, all four names as Subject Alternative Names — simpler
than managing separate certs:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d app.fieldopspro.in -d fieldopspro.in -d www.fieldopspro.in -d api.fieldopspro.in \
  --email <your-email-for-expiry-notices> --agree-tos --no-eff-email
```

This creates `/etc/letsencrypt/live/app.fieldopspro.in/` (named after
the first `-d`) inside the `certbot-etc` volume — matches what
`nginx/vansales.conf.example` already points at.

## 5. Switch to the real nginx config and bring everything up

```bash
cp nginx/vansales.conf.example nginx/vansales.conf   # already carries fieldopspro.in

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

The `backend` container runs `migrate` + `collectstatic` automatically
on start (see its `command:` in `docker-compose.prod.yml`) — no manual
migration step needed here or on future deploys.

Check everything's healthy:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend --tail 50
```

## 6. Create the client's first data

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_default_roles
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Then create the `Company`/`GSTRegistration` row(s) — either via Django
admin at `https://api.fieldopspro.in/admin/` (log in with the superuser
above) or a one-off shell command; see `docs/PROVISIONING.md` §2 for the
exact snippet. **Do not run `seed_demo_data`** against this database —
that command is for local dev/demo only.

From here, `docs/PROVISIONING.md` §3–5 cover the rest (ERP connector
setup, onboarding users, master data, beats) — identical for a
production deployment.

## 7. Verify

- `https://app.fieldopspro.in`, `https://fieldopspro.in`, and
  `https://www.fieldopspro.in` all load the login page, padlock shows
  a valid cert on each.
- `https://api.fieldopspro.in/api/` responds (401 without a token is
  correct — confirms the domain reaches Django, not that auth works).
- Log in via the superuser account created in step 6.
- Point the mobile app's API base URL at `https://api.fieldopspro.in`
  and confirm a sync pull succeeds.

## 8. Backups

```bash
crontab -e
# add:
0 2 * * * /full/path/to/vansales-saas/infra/backup.sh >> /var/log/vansales-backup.log 2>&1
```

`infra/backup.sh` keeps 14 days of gzipped `pg_dump` output locally by
default. Once the client has real data worth protecting off-box, add an
R2/S3 upload — the script has a commented example line for `rclone`.

## 9. Ongoing maintenance

- **Cert renewal**: Certbot certs last 90 days. Add a monthly cron entry:
  ```
  0 3 1 * * cd /path/to/vansales-saas/infra && docker compose -f docker-compose.prod.yml run --rm certbot renew && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
  ```
- **Deploying a code update**: `git pull`, then (from `infra/`)
  `docker compose -f docker-compose.prod.yml up -d --build`
  (rebuilds only what changed; migrate/collectstatic re-run automatically).
- **Checking logs**: `docker compose -f docker-compose.prod.yml logs -f <service>`.

## Optional next steps (not needed to go live)

- Move media storage (signatures, logos) to S3-compatible object storage
  (Cloudflare R2 — free egress) once local disk usage becomes a concern;
  requires adding `django-storages` and a `STORAGES["default"]` override
  in `config/settings/production.py`, currently `FileSystemStorage`.
- Add `output: "standalone"` to `admin-web/next.config.ts` for a smaller
  production image (currently ships full `node_modules`).
- Set `SENTRY_DSN` for error tracking — already wired up in
  `config/settings/production.py`, just needs the env var.
- Wrap admin-web as an installable Android APK (Trusted Web Activity),
  once `app.fieldopspro.in` above is a real, live HTTPS domain — a TWA
  can't be built against a placeholder or localhost, because Android
  verifies the APK against a `.well-known/assetlinks.json` file hosted
  on that same domain (this is what lets the app open full-screen,
  without a browser URL bar, unlike a plain "Add to Home Screen"
  bookmark). Steps once the domain is live:
  1. `npm install -g @bubblewrap/cli`
  2. `bubblewrap init --manifest https://app.fieldopspro.in/manifest.webmanifest`
     — this reads the existing PWA manifest (`admin-web/public/manifest.webmanifest`,
     already shipped) and interactively asks for a package name (e.g.
     `com.bpro.fieldops.admin`), app name, and signing key details;
     generates a `twa-manifest.json` + Android project.
  3. `bubblewrap build` — produces a signed release APK/AAB and prints
     the SHA-256 fingerprint of the signing key.
  4. Add that fingerprint to `admin-web/public/.well-known/assetlinks.json`
     (Bubblewrap prints the exact JSON to paste) and deploy — nginx
     already serves static files from `admin-web/public/`, so no new
     server config is needed, just the file existing before the next
     deploy.
  5. Re-run `bubblewrap build` after any admin-web `manifest.webmanifest`
     change (icon, name, theme color) to keep the wrapper in sync.
  A mirror of `mobile-android-ci.yml` could automate steps 2–3 once the
  signing key is generated once and stored as a repo secret — not set up
  yet since it needs that one-time interactive key generation first.
