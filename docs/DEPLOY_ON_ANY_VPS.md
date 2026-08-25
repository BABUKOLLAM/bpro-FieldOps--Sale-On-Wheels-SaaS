# Deploy on Any VPS

This is the simplest deployment flow for any dedicated VPS or VM.

It is designed to be portable across hosting providers and does not depend on any vendor-specific service.
This runbook is for an **exclusive VPS**: this application owns its reverse
proxy ports and does not join another project's Docker network or reverse proxy.
Do not use the shared-Caddy compose topology for this deployment.

## 1. Server preparation

On the target VPS:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git docker.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

Verify:

```bash
docker --version
docker compose version
```

## 2. DNS setup

Create A records for your app and API domains:

```text
app.example.com   -> VPS_IP
api.example.com   -> VPS_IP
www.example.com   -> VPS_IP
```

Replace `example.com` with your actual domain names.

## 3. Clone the project

```bash
cd /opt
git clone <repo-url> app
cd /opt/app
```

## 4. Prepare production env

```bash
cp infra/.env.production.template infra/.env
chmod 600 infra/.env
nano infra/.env
```

Use your real production values, for example:

```env
DJANGO_SETTINGS_MODULE=config.settings.production
DEBUG=0
SECRET_KEY=your-real-secret
FIELD_ENCRYPTION_KEY=your-real-fernet-key
CONNECTOR_API_KEY=your-real-connector-key
POSTGRES_PASSWORD=your-real-strong-password
ALLOWED_HOSTS=api.example.com,backend
CORS_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
FRONTEND_BASE_URL=https://app.example.com
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
POSTGRES_DB=vansales
POSTGRES_USER=vansales
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
REDIS_URL=redis://redis:6379/0
```

Important:
- no `localhost`
- no `example.com` placeholders
- no test credentials
- use your actual production domains

## 5. Start the app stack

From the project root:

```bash
cd /opt/app/infra
APP_DOMAIN=app.example.com API_DOMAIN=api.example.com ./deploy-generic.sh
```

The deployment uses the fixed Compose project `fieldops-prod` and private
Docker network `fieldops-prod-network`. PostgreSQL and Redis have no host
ports. The deploy preflight refuses to proceed if ports 80 or 443 are already
owned by another host process, preventing disruption to an existing service.

This script builds the containers, starts the app, and checks the frontend and backend health endpoints.

## 6. Validate

Check the API:

```bash
curl -I https://api.example.com/healthz/
```

Check the web app:

```bash
curl -I https://app.example.com/
```

## 7. Create the first admin user

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

## 8. Operational notes

- Keep the env file outside source control and protected by file permissions
- Use TLS at the edge or reverse proxy
- Keep database and Redis private to this app
- Keep secrets in a password manager or secret manager
- Reuse this same process when migrating to another VPS later

This setup is portable by design and does not depend on a specific hosting provider.
The VPS must be dedicated to this application, or otherwise have ports 80/443
reserved exclusively for it. A VPS already serving another application cannot
meet the exclusive-isolation requirement without moving one of the workloads.
