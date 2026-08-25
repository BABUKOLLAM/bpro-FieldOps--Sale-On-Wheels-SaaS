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

**If this VPS already runs Caddy for other projects** (a shared box
hosting more than one client site, each with its own reverse proxy
entry in one Caddyfile) — skip straight to
["Shared VPS behind an existing Caddy"](#shared-vps-behind-an-existing-caddy)
near the end of this doc instead of the steps below. Steps 1, 3, 4, and 5
differ in that case (no certbot, a different nginx config, a different
compose file) — trying to run this doc's default nginx-owns-TLS-directly
path on a box where Caddy already holds ports 80/443 fails with
`Bind for 0.0.0.0:80 failed: port is already allocated`.

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

This project supports two patterns for providing production secrets:

A) Traditional file-backed env (simple)

```bash
cd vansales-saas/infra
cp ../.env.production.example .env
# edit infra/.env with real values for SECRET_KEY, POSTGRES_PASSWORD, FIELD_ENCRYPTION_KEY, CONNECTOR_API_KEY, etc.
```

B) Recommended: use HashiCorp Vault (preferred for SaaS)

When delivering this as a SaaS offering for multiple clients, storing
production secrets in a managed secret store is strongly recommended.
This repo supports optional runtime lookup of secrets from Vault. To use
Vault in production:

1. Configure a KV secrets engine (KV v2 recommended) at `secret/`.
2. Store secrets under paths such as `secret/data/SECRET_KEY` with the
   secret stored as a map. Example (KV v2):

```bash
vault kv put secret/SECRET_KEY value="$SECRET_KEY_VALUE"
vault kv put secret/POSTGRES_PASSWORD value="$POSTGRES_PASSWORD"
vault kv put secret/FIELD_ENCRYPTION_KEY value="$FIELD_ENCRYPTION_KEY"
vault kv put secret/CONNECTOR_API_KEY value="$CONNECTOR_API_KEY"
```

3. On the host or orchestrator, set the following environment variables
   in the process that runs the Django container (do not check them into
   source control):

- `VAULT_ADDR` (e.g. "https://vault.company.internal:8200")
- `VAULT_TOKEN` (or use AppRole/short-lived token injection for
  production; do not store long-lived root tokens on disk)
- Optionally: `VAULT_KV_V2=0` if your Vault uses KV v1

4. The Django settings module will attempt to read secrets from Vault
   at startup and will fall back to env variables when Vault is not
   configured. If Vault is configured but a critical secret is missing
   or Vault is unreachable, the production settings will fail fast and
   stop the container from starting — this is intentional.

Operational notes:

- Prefer AppRole or autoinjectors (Kubernetes Vault Agent) to long-lived
  tokens in the environment.
- Rotate Vault tokens and secrets regularly.
- For on-prem deployments without Vault, continue using the infra/.env
  file, but ensure it is stored only in the host's secure store and not
  in version control.

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

## Shared VPS behind an existing Caddy

Skip this whole section if this box only ever hosts this one project —
use steps 1–7 above instead. This path is for a VPS that already runs
Caddy as the front door for other client sites, each with its own entry
in one shared Caddyfile (discovered in practice on the current
production VPS: `docker-proxy` already held ports 80/443 for Caddy, and
`/root/<other-project>/deploy/Caddyfile` existed for sibling projects —
the same convention this section follows).

Caddy terminates TLS for every hostname on the box and reverse-proxies
plain HTTP to each project's own containers over the internal Docker
network, by Compose service name. This project's nginx therefore never
terminates TLS itself and never needs to be reachable from the host
directly — only from Caddy, container-to-container. Two files exist
specifically for this:

- `infra/nginx/vansales.caddy-fronted.conf.example` — nginx listens on
  plain `80` only (no `ssl` block, since it would need certificate
  files this path never generates), doing the same Host-header routing
  to admin-web/backend as the standalone config.
- `infra/docker-compose.prod.caddy-fronted.yml` — the same stack as
  `docker-compose.prod.yml` minus nginx's host port publish (Caddy
  already holds 80/443; publishing them again from this project's nginx
  conflicts — `Bind for 0.0.0.0:80 failed: port is already allocated`
  is that conflict) and minus the `certbot` service (nothing here ever
  calls it, since Caddy handles all certificate issuance itself).

Steps, replacing 1/3/4/5 above:

1. **DNS** — same four A records as step 1, all pointed at the VPS's
   existing IP (the one Caddy is already reachable on).
2. **Configure secrets** — identical to step 2.
3. **nginx config**:
   ```bash
   mkdir -p nginx
   cp nginx/vansales.caddy-fronted.conf.example nginx/vansales.conf
   ```
4. **Add this project's Caddy block** — merge `deploy/Caddyfile`'s
   contents into the box's shared Caddyfile (find it with
   `docker inspect <caddy-container> --format '{{ range .Mounts }}{{ .Source }} -> {{ .Destination }}{{println}}{{end}}'`
   to locate the host-side file Caddy's container has it bind-mounted
   from — editing inside the container's own filesystem layer won't
   persist across a container restart). Then reload Caddy so it picks
   up the change and provisions certificates for the new hostnames —
   `docker exec <caddy-container> caddy reload --config /etc/caddy/Caddyfile`,
   or restart the container if `reload` isn't available. This step is
   the one place DNS actually matters here: Caddy's automatic HTTPS
   can't provision a certificate for a hostname that doesn't yet
   resolve to this VPS.
5. **Build and bring the stack up** (this project's own containers —
   the shared Caddy container is managed separately, not by this
   compose file):
   ```bash
   docker compose -f docker-compose.prod.caddy-fronted.yml build
   docker compose -f docker-compose.prod.caddy-fronted.yml up -d
   ```

Steps 2 ("Configure secrets"), 6 ("Create the client's first data"), 7
("Verify"), 8 ("Backups"), and 9 ("Ongoing maintenance") above all
still apply as written — only replace every `docker-compose.prod.yml`
in those commands with `docker-compose.prod.caddy-fronted.yml`, and
skip the cert-renewal cron entry in step 9 (Caddy renews its own
certificates automatically; there's nothing here for this project's
own cron to do).

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

Day-2 operations — deploys, rollbacks, backup restore-testing, health
checks, and the stack's known failure modes — live in
[OPERATIONS.md](OPERATIONS.md). The short version:

- **Deploying a code update**: `cd infra && ./deploy.sh` — never the
  manual pull/build/up sequence (the script also restarts the proxies
  and verifies the site actually came back; see OPERATIONS.md for why
  each of those steps exists).
- **Rolling back**: `./deploy.sh <previous-commit>` (every deploy
  prints this command for its predecessor).
- **Cert renewal** (standalone-nginx path only; the shared-Caddy path
  renews itself). Certbot certs last 90 days — add a monthly cron entry:
  ```
  0 3 1 * * cd /path/to/vansales-saas/infra && docker compose -f docker-compose.prod.yml run --rm certbot renew && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
  ```
- **Checking logs**: `docker compose -f <compose-file> logs -f <service>`.

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

## GitHub Actions CI/CD Configuration

The repository includes automated CI/CD with image building, security scanning, signing, and optional automated deployment to the VPS. To enable the full CI/CD pipeline, configure the following secrets and environments in your GitHub repository settings.

### Required Secrets for Image Push & Security

1. **GITHUB_TOKEN** (automatic, provided by GitHub)
  - Required: Package write permission for pushing to GitHub Container Registry (GHCR)
  - Configure in: **Settings → Actions → General → Workflow permissions** → Enable **Read and write permissions**

### Optional Secrets for Automated VPS Deployment

If you want CI to automatically deploy to the VPS after passing tests and security scans, configure these secrets:

1. **VPS_SSH_PRIVATE_KEY** (required for auto-deploy)
  - A private SSH key that can authenticate to the VPS
  - Format: Copy the full PEM private key (including `-----BEGIN OPENSSH PRIVATE KEY-----` header)
  - Add to: **Settings → Secrets and variables → Actions** → New repository secret named `VPS_SSH_PRIVATE_KEY`

2. **VPS_HOST** (required for auto-deploy)
  - The IP address or hostname of your VPS
  - Example: `203.0.113.10` or `vps.example.com`
  - Add to: **Settings → Secrets and variables → Actions** → New repository secret named `VPS_HOST`

3. **VPS_SSH_USER** (required for auto-deploy)
  - The SSH user account on the VPS (usually `ubuntu`, `root`, or `deploy`)
  - Add to: **Settings → Secrets and variables → Actions** → New repository secret named `VPS_SSH_USER`

4. **VPS_SSH_PORT** (optional, defaults to 22)
  - Non-standard SSH port if your VPS doesn't use the default
  - Add to: **Settings → Secrets and variables → Actions** → New repository secret named `VPS_SSH_PORT`

5. **VPS_REPO_PATH** (required for auto-deploy)
  - Absolute path to this repository on the VPS
  - Example: `/home/deploy/bpro-fieldops` or `/opt/vansales-saas`
  - Add to: **Settings → Secrets and variables → Actions** → New repository secret named `VPS_REPO_PATH`

### Protected Deployment Environment (Manual Approval)

To require manual approval before deploying to production:

1. Go to **Settings → Environments**
2. Click **New environment** and name it `production`
3. Under **Deployment branches**, select **All branches**
4. Check **Require reviewers** and add team members who can approve deployments
5. (Optional) **Restrict deployments** to a specific branch (e.g., `main`)

Once configured, any deployment triggered by the CI workflow will pause and wait for a reviewer to approve before proceeding to the VPS.

### Image Signing with Keyless OIDC (Production Recommended)

The CI workflow uses keyless signing via Sigstore/cosign and OIDC integration. This approach does not require storing long-lived signing keys in secrets:

- **No additional secrets required** — OIDC tokens are minted by GitHub per workflow run
- **Automatic verification** — users can verify images with: `cosign verify --certificate-oidc-issuer https://token.actions.githubusercontent.com ghcr.io/<owner>/<repo>/vansales-backend:latest`
- **Best practice** — recommended for production CI/CD pipelines

No configuration needed — the workflow automatically uses the GitHub OIDC issuer and Sigstore public trust root.

### SBOM (Software Bill of Materials) & Compliance

The CI workflow automatically generates CycloneDX SBOMs (via Anchore Syft) for every image build:

- **On every main branch push**: SBOMs are uploaded as workflow artifacts (e.g., sbom-backend-<sha>.json)
- **On every Git tag/release**: SBOMs are automatically attached to the GitHub Release for compliance and auditing

Access SBOMs:
- **Build artifacts**: Go to **Actions** → Select the workflow run → **Artifacts** section
- **Release assets**: Go to **Releases** → Select the release → SBOMs are attached as downloadable files

### Security Scanning (Trivy)

The CI workflow scans all built images with Trivy for vulnerabilities:

- **Severity level**: HIGH and above (CRITICAL)
- **Behavior**: Build fails and images are NOT pushed if HIGH/CRITICAL vulnerabilities are found
- **Remediation**: Update dependencies (especially base OS and Python packages) and push again

To monitor findings or adjust sensitivity:
- Review the workflow run output in **Actions** → Workflow name → Latest run
- Trivy report is printed in the logs
- To allowlist known acceptable findings, edit `.github/workflows/backend-ci.yml` and add `--skip-db-update --severity HIGH` flags with a custom policy file

### Building Images Locally (Without CI)

If you want to build and push images manually:

```bash
cd infra
docker compose -f docker-compose.prod.yml build backend admin-web

# Tag and push manually (requires docker login to ghcr.io first)
docker tag <image-id> ghcr.io/<owner>/<repo>/vansales-backend:manual-build
docker push ghcr.io/<owner>/<repo>/vansales-backend:manual-build
```

Or use the tag-based deploy flow:

```bash
export IMAGE_REGISTRY=ghcr.io/<owner>/<repo>/
export IMAGE_TAG=manual-build
./deploy.sh  # pulls images from the registry instead of building locally
```
