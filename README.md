# Van Sales SaaS — Field Sales & Fleet Management Platform

Phase 1 MVP of a field/van sales platform: offline-first mobile billing app,
web admin/back-office panel, and a Tally Prime sync layer. Built as a
per-client-deployment template — see [`docs/PROVISIONING.md`](docs/PROVISIONING.md)
for how a new client instance is stood up, and [`docs/architecture.md`](docs/architecture.md)
for the system design.

## Components

| Folder | Stack | Purpose |
|---|---|---|
| `backend/` | Django + DRF + PostgreSQL + Celery | API, business rules, Tally sync orchestration |
| `admin-web/` | Next.js (TypeScript) | Back-office dashboard, master data, approvals |
| `mobile/` | React Native (TypeScript) + WatermelonDB | Offline-first field sales app |
| `infra/` | Docker Compose | Local dev stack (Postgres, Redis, backend, Celery, admin-web) |

## Quick start (local dev)

```bash
cp .env.example .env   # edit values for your machine
cd infra
docker compose up --build
```

Then, in a separate shell, seed demo data:

```bash
docker compose exec backend python manage.py seed_demo_data
```

- Backend API: http://localhost:8000/api/
- API schema/docs: http://localhost:8000/api/schema/swagger-ui/
- Admin web: http://localhost:3000

Demo login (after seeding): `tech@bpropms.com` / `Bpro#1234`

## Mobile app

```bash
cd mobile
npm install
npm run ios     # or: npm run android
```

Set `API_BASE_URL` in `mobile/.env` to your backend's reachable address
(use your machine's LAN IP, not `localhost`, when testing on a physical device).

## Status

Phase 1 MVP vertical slice — see [`docs/architecture.md`](docs/architecture.md) for
what's implemented vs. the fuller BRD roadmap (Phase 2/3 features are intentionally
out of scope for this build).
