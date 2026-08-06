# Provisioning a new client

This repo is a template: every client gets their own deployment and
database, not a shared multi-tenant backend. There is no automated
central registry yet (see `docs/architecture.md` — that's a natural
follow-up once the first few clients are onboarded); for now, provisioning
is: clone/deploy this repo, configure `.env`, run the steps below.

## 1. Create the deployment

1. Provision a Postgres database and a Redis instance for this client.
2. Deploy `backend/` (Docker image via `backend/Dockerfile`, or your
   platform of choice) with its own `.env` — copy `.env.example` at the
   repo root and fill in, per client:
   - `SECRET_KEY` — generate a fresh one, never reuse across clients
   - `COMPANY_NAME`
   - `POSTGRES_*` — this client's database
   - `FIELD_ENCRYPTION_KEY` — generate with
     `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`,
     unique per client (encrypts stored ERP connector credentials)
   - `CONNECTOR_API_KEY` — a random secret; this same value goes into the
     on-prem connector agent's config for this client
   - `ALLOWED_HOSTS` / `CORS_ALLOWED_ORIGINS` — this client's domains
3. Deploy `admin-web/` with `NEXT_PUBLIC_API_BASE_URL` pointed at this
   client's backend URL.
4. Deploy `celery-worker` and `celery-beat` processes against the same
   `.env` (see `infra/docker-compose.yml` for the reference commands).

## 2. Initialize the database

```bash
python manage.py migrate
python manage.py seed_default_roles
```

Then create the client's actual `Company`/`GSTRegistration` row(s) and
first admin user — either via Django admin (`/admin/`) or a one-off
management shell:

```python
from apps.company.models import Company, GSTRegistration
company = Company.objects.create(legal_name="Client Legal Name")
GSTRegistration.objects.create(
    company=company, state="MH", gstin="...", address_line1="...",
    city="...", pincode="...", is_default=True,
)
```

`seed_demo_data` is for local dev/demo only — do not run it against a
real client database.

## 3. Configure the ERP connection

In Django admin, create an `ERPConnection` row for this client:

- `erp_type`: `tally` for a real deployment (`mock` only for demos)
- `sync_mode`: `batch` (default, 15–30 min interval) or `realtime`
- `credentials`: set via `ERPConnection.credentials = {...}` — encrypted
  at rest using `FIELD_ENCRYPTION_KEY`

## 4. Install the on-prem connector agent (Tally clients only)

On a PC on the same LAN as the client's Tally Prime install (see
`backend/apps/integrations/connector_agent/README.md`):

```bash
VANSALES_API_BASE_URL=https://<this-client's-backend-url> \
VANSALES_CONNECTOR_KEY=<the CONNECTOR_API_KEY from step 1> \
TALLY_URL=http://localhost:9000 \
python agent.py
```

Package as a standalone executable (`pyinstaller --onefile agent.py`) and
install as a Windows service for unattended operation. No inbound port
needs to be opened — the agent only makes outbound calls.

## 5. Onboard users and master data

1. Create the client's field agents/supervisors/back-office users and
   assign roles (Django admin, or the admin-web User & Role screen once
   built out beyond the MVP's 3 core screens).
2. Load initial catalog (items, price lists) and customer master data —
   either manually, via Django admin, or by running the client's first
   Tally master-pull once the connector agent is running.
3. Define beats/routes and assign agents.
4. Have each field agent log into the mobile app with their credentials
   and this client's backend URL (or a company code, if that lookup
   mechanism is added later).

## Known gap

There's no automated way today to provision a new client end-to-end
(database creation, secret generation, DNS) — each step above is manual
or scripted ad hoc. If/when this scales past a handful of clients, build
a proper control-plane (a registry app similar to the org's existing
`bpro-portal` pattern) rather than continuing to do this by hand.
