# Dedicated VPS Production Deployment Guide

This is the next-step deployment plan for running this project as a single independent SaaS application on any dedicated VPS provider.

Hostinger is just one example target; the architecture is intentionally vendor-neutral so the same setup can later be moved to another cloud or hosting platform without reworking the application design.

The goal is to keep it isolated from other software, with one app stack, one database, one Redis instance, and one public domain pair.

## 1. Deployment model

Use this model:

- Application domain: https://app.yourdomain.com
- API domain: https://api.yourdomain.com
- VPS: single dedicated server, no shared app stack
- Stack:
  - Docker Compose
  - PostgreSQL
  - Redis
  - Django backend
  - Celery worker + beat
  - Next.js admin app
  - nginx reverse proxy
- TLS: Let's Encrypt via Caddy or nginx certbot

This is intentionally a standalone SaaS deployment, not a shared multi-project host.

## 2. Server prerequisites

On the dedicated VPS:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git docker.io docker-compose-plugin certbot python3-certbot-nginx
sudo systemctl enable docker
sudo systemctl start docker
```

Verify:

```bash
docker --version
docker compose version
```

## 3. DNS setup

Create these DNS A records to the VPS IP regardless of provider:

- app.yourdomain.com -> VPS IP
- api.yourdomain.com -> VPS IP
- www.yourdomain.com -> VPS IP
- yourdomain.com -> VPS IP

Allow DNS propagation before starting the stack.

## 4. Prepare the repository on the VPS

From the server:

```bash
git clone https://github.com/<your-org>/<your-repo>.git /opt/bpro-fieldops
cd /opt/bpro-fieldops
```

Then create the production environment file:

```bash
cp infra/.env.production.template infra/.env
chmod 600 infra/.env
```

Edit the file with real production values:

```bash
nano infra/.env
```

Required values:

```env
SECRET_KEY=...real-random-value...
FIELD_ENCRYPTION_KEY=...fernet-key...
CONNECTOR_API_KEY=...real-random-value...
POSTGRES_PASSWORD=...strong-20plus-character-password...
ALLOWED_HOSTS=api.yourdomain.com,backend
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com,https://yourdomain.com,https://www.yourdomain.com
FRONTEND_BASE_URL=https://yourdomain.com
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
AUTH_COOKIE_DOMAIN=.yourdomain.com
DJANGO_SETTINGS_MODULE=config.settings.production
DEBUG=0
```

Use real domains only. Do not leave localhost or example.com.

## 5. Generate secrets

Generate the required values locally or on the VPS:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

For PostgreSQL:

```bash
python3 -c "import secrets, string; chars=string.ascii_letters + string.digits + '!@#$%^&*'; print(''.join(secrets.choice(chars) for _ in range(28)))"
```

## 6. TLS and reverse proxy

For a single dedicated VPS, the recommended deployment is:

- one nginx container handling app and API routing
- Caddy or certbot handling TLS termination
- NO shared app layering with any unrelated service

If using the included nginx config, make sure the upstream hostnames match the container names in Docker Compose:

- app.yourdomain.com -> admin-web:3000
- api.yourdomain.com -> backend:8000

The included config in [infra/nginx/vansales.conf](infra/nginx/vansales.conf) already supports this arrangement for a dedicated production stack.

## 7. Start the app stack

From the project root on the VPS:

```bash
cd /opt/bpro-fieldops/infra
docker compose -f docker-compose.prod.yml up -d --build
```

Check status:

```bash
docker compose -f docker-compose.prod.yml ps
```

Watch logs if needed:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

## 8. Validate the deployment

Check backend health:

```bash
curl -I https://api.yourdomain.com/healthz/
```

Check app front-end:

```bash
curl -I https://app.yourdomain.com/
```

You should get successful HTTP responses, not TLS or host-header errors.

## 9. Admin user creation

Create the first superuser:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Then sign in to the web console using the production domain.

## 10. Production hardening checklist

Before declaring the instance live, verify all of the following:

- [ ] .env contains production-only real domains
- [ ] no localhost appears in production config
- [ ] no example.com remains anywhere in env values
- [ ] `SECRET_KEY` is unique and strong
- [ ] `FIELD_ENCRYPTION_KEY` is valid Fernet
- [ ] `POSTGRES_PASSWORD` is strong and stored securely
- [ ] `NEXT_PUBLIC_API_BASE_URL` matches the public API domain
- [ ] `FRONTEND_BASE_URL` matches the web app domain
- [ ] TLS is enabled and valid
- [ ] backend health endpoint returns 200
- [ ] app domain loads successfully
- [ ] DB and Redis are private to this stack
- [ ] no unrelated app is sharing the same container network

## 11. Recommended next phase

Once the app is live on any dedicated VPS:

- enable automated backups
- set up log rotation
- configure Sentry or equivalent monitoring
- add scheduled DB snapshot backups
- keep secrets in a password manager or Vault
- rotate secrets on a scheduled basis

This keeps the project aligned to a professional SaaS deployment standard instead of a shared or ad-hoc host setup.
