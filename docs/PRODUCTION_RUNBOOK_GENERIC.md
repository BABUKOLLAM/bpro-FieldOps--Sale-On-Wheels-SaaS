# Generic Production Runbook for a Dedicated SaaS VPS

This runbook is designed for a production deployment that is completely independent of any specific hosting provider.

It works for:

- any VPS provider
- any domain registrar or DNS provider
- any CI/CD pipeline
- future relocation to another host without changing app code

The goal is a clean, portable deployment model: a dedicated runtime environment, real domain names, environment-managed secrets, and a single isolated app stack.

---

## 1. Deployment philosophy

The application must be deployable as a single independent SaaS instance with no vendor lock-in.

The runtime should be defined by environment variables, DNS records, and infrastructure—not by hardcoded hosting assumptions.

Production design rules:

- do not hardcode provider names
- do not hardcode localhost or example domains
- treat all external URLs as environment values
- isolate app services behind a private Docker network
- keep secrets outside source control
- keep database and Redis private to the app runtime
- keep the app behind a reverse proxy or edge gateway

---

## 2. Runtime architecture

Use a dedicated instance with the following structure:

- reverse proxy / TLS terminator
- app frontend container
- backend API container
- PostgreSQL container or managed database
- Redis container or managed cache
- Celery worker container
- Celery beat container
- optional monitoring and log aggregation

Recommended public domain split:

- app.example.com -> frontend
- api.example.com -> backend
- optional www.example.com -> redirect or same frontend

This keeps the frontend and API logically separated while staying simple to operate.

---

## 3. Production environment contract

All runtime-specific settings must live in environment variables.

Minimum required variables:

```env
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=...
DEBUG=0
ALLOWED_HOSTS=api.example.com,backend
CORS_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
FRONTEND_BASE_URL=https://app.example.com
POSTGRES_DB=vansales
POSTGRES_USER=vansales
POSTGRES_PASSWORD=...
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
REDIS_URL=redis://redis:6379/0
FIELD_ENCRYPTION_KEY=...
CONNECTOR_API_KEY=...
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

These values must be entered at deployment time for the target environment. They must never be embedded in application code.

---

## 4. Security requirements for any host

### Secrets

Store secrets in:

- vault
- password manager
- cloud secret manager
- deployment environment secrets manager
- or a secure private config file with restricted permissions

Never commit these to the repository.

### Hostname policy

Production must reject any of the following values:

- localhost
- 127.0.0.1
- example.com
- any placeholder domain used as a template

The app must fail fast if a live deployment is configured with these values.

### TLS

Production deployments must use HTTPS. The edge layer or reverse proxy must enforce TLS termination and redirect insecure traffic.

Recommended headers:

- HSTS
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- secure cookies

---

## 5. DNS and network requirements

Allocate real public domains for the app and API:

- app.example.com
- api.example.com

Configure DNS records to point to the target server IP.

The same app should work on any provider as long as:

- the target server is reachable
- DNS records are correct
- TLS is configured
- the environment values match the actual domain

No code changes should be required when moving to another host.

---

## 6. VPS provisioning checklist

Use the target VPS provider of choice and ensure:

- OS is current and patched
- Docker is installed
- Docker Compose is installed
- SSH access is configured
- firewall is active
- nonessential ports are closed
- required ports are open: 22, 80, 443
- time sync is configured
- swap or memory capacity is adequate
- storage is monitored

The application should not depend on any vendor-specific package installation beyond standard Linux + Docker setup.

---

## 7. Infrastructure setup

### Docker network

The app stack should remain private to itself.

Recommended private service topology:

- backend
- postgres
- redis
- celery worker
- celery beat
- admin-web
- nginx

The frontend and backend should talk over the internal Docker network; only the reverse proxy should be exposed publicly.

### Reverse proxy

A reverse proxy should forward:

- https://app.example.com -> frontend container
- https://api.example.com -> backend container

This keeps the internal backend ports closed from the public internet.

---

## 8. Deployment procedure

### Step 1: prepare the target environment

On the server:

```bash
sudo apt update && sudo apt install -y curl git docker.io docker-compose-plugin
```

Clone the repository:

```bash
git clone <repo-url> /opt/app
cd /opt/app
```

### Step 2: configure working environment

Create a production env file from the template:

```bash
cp infra/.env.production.template infra/.env
chmod 600 infra/.env
```

Edit it with real production values.

Check that the file contains no placeholders, no localhost, and no example domains.

### Step 3: verify secrets and domains

Before starting the stack, verify:

```bash
grep -E "SECRET_KEY=|FIELD_ENCRYPTION_KEY=|CONNECTOR_API_KEY=|POSTGRES_PASSWORD=|ALLOWED_HOSTS=|FRONTEND_BASE_URL=|NEXT_PUBLIC_API_BASE_URL=" infra/.env
```

Ensure all values are real and match the target domains.

### Step 4: start services

```bash
cd infra
docker compose -f docker-compose.prod.yml up -d --build
```

Check health:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

### Step 5: verify the app

Test API:

```bash
curl -I https://api.example.com/healthz/
```

Test frontend:

```bash
curl -I https://app.example.com/
```

If the checks succeed, the app is deployed correctly.

---

## 9. CI/CD portability

The CI/CD workflow should be environment-driven and not tied to a specific provider.

The pipeline should support:

- build image from source
- push to registry or artifact store
- deploy with environment variables injected from secrets manager
- run smoke tests against the actual target domain
- validate health checks before promoting to live

Examples of portable deployment strategies:

- GitHub Actions + registry + SSH deploy
- GitLab CI
- Azure DevOps
- self-hosted runner
- generic Docker image pipeline

The app code should only know about repositories, registries, and environment values, not host vendor details.

---

## 10. Moving between hosts without code changes

To move the same application to a different host:

1. provision new server
2. install Docker + dependencies
3. copy repo or image artifact
4. set production environment variables for the new server
5. configure DNS records for the domain
6. deploy the same image or same codebase
7. verify health endpoints
8. switch DNS when ready

No application code change should be required as long as:

- domain names are updated in deployment values
- secrets are re-injected for the new environment
- TLS is reconfigured
- database and Redis are restored or recreated appropriately

---

## 11. Post-deployment operational checklist

Before considering the instance production-ready, confirm:

- [ ] app and API domains resolve publicly
- [ ] HTTPS is active and valid
- [ ] backend health endpoint returns 200
- [ ] frontend loads without errors
- [ ] database and Redis are healthy
- [ ] logs are being collected
- [ ] backups are enabled
- [ ] secrets are rotated and stored securely
- [ ] no placeholder values remain in env files
- [ ] no localhost or example domains remain in runtime config
- [ ] there are no host-specific code assumptions

---

## 12. Production maintenance

Recommended operational practices:

- scheduled DB backups
- log rotation
- secret rotation schedule
- service health monitoring
- alerting on failed deployments or health checks
- image or container rebuilds for updates
- stale artifact cleanup

This keeps the stack portable and maintainable for the long term.

---

## 13. Final deployment principle

The application should be considered production-ready when it is deployable on any dedicated VPS with real public domains, environment-driven configuration, and no code changes tied to a hosting vendor.

That is the correct SaaS baseline for a scalable, portable, production-grade deployment model.
