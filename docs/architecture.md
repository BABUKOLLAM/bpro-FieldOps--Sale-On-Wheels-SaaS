# Architecture

Phase 1 MVP of the Field Sales / Van Sales SaaS platform. This document
covers what's implemented, the key design decisions, and what's
deliberately deferred beyond this build.

## Deployment model: isolated deployment per client

This codebase is a **template repo**, not a multi-tenant application.
Every client gets their own:

- Postgres database (not a shared schema)
- Django backend deployment (own `.env`: `SECRET_KEY`, `DB_*`, `COMPANY_NAME`, `ALLOWED_HOSTS`, connector API key)
- Admin-web deployment, pointed at their backend's API URL
- Mobile app build (or a "server URL" entered once at first login)

This matches how the rest of the org runs client products (see
`docs/PROVISIONING.md`), and avoids the correctness risk of a missed
tenant filter on a financial/GST table in a shared-schema design.

## Components

```
backend/     Django + DRF + PostgreSQL + Celery — API, business rules, Tally sync
admin-web/   Next.js (TypeScript) — back-office dashboard, master data, approvals
mobile/      React Native (TypeScript) + WatermelonDB — offline-first field app
infra/       docker-compose for local dev (postgres, redis, backend, celery, admin-web)
```

## Backend app breakdown

| App | Responsibility |
|---|---|
| `core` | `BaseModel` (UUID pk + timestamps), shared pagination/exception handling |
| `company` | Single `Company` row for this deployment + `GSTRegistration` (multi-state GST) |
| `accounts` | `User`, `Role`/`UserRole` (RBAC), `Device`, `AuditLog`, JWT auth endpoints |
| `catalog` | Items, UOM, price lists, MVP scheme/discount engine |
| `customers` | Customers (credit limit/outstanding/blocked), beats/routes |
| `sales` | SalesOrder, Invoice, Receipt, CreditNote — GST calc, credit checks, stock posting |
| `inventory` | Godowns, the stock ledger (source of truth), van load/unload with variance |
| `fleet` | Vehicles, trips, checkpoints, odometer/fuel logs, maintenance |
| `integrations` | Tally/Busy/Marg sync layer: `ERPConnection`, `SyncLogEntry`, connectors, on-prem agent |
| `mobile_sync` | Offline pull/push protocol, push idempotency |
| `reporting` | Live dashboard aggregation, targets |

## Data integrity: UUID primary keys everywhere

Every domain model uses a client-assignable UUID primary key
(`apps.core.models.BaseModel`). This isn't just style — it's what makes
offline creation safe: a mobile app generates an Invoice's ID *before* it
has ever talked to the server, and that same ID is the idempotency key
used by both `apps.mobile_sync` (dedupe a retried push) and
`apps.integrations.SyncLogEntry` (guarantee it's never posted to Tally
twice).

## Offline-first mobile sync

- **Local storage**: WatermelonDB (SQLite/JSI), bare React Native CLI —
  not Expo managed, since Bluetooth printer/barcode/biometric native
  modules and WatermelonDB's native module all need it.
- **Conflict avoidance by design**: transactional records (Invoice,
  Receipt, CreditNote, Trip, TripCheckpoint) are create-only from mobile
  with a client-generated UUID — there is structurally no concurrent-edit
  conflict. Master data (Customer, Item, PriceList) is server-authoritative
  and read-only on mobile.
- **Pull** (`GET /api/sync/pull/?since=<iso>`): cursor-based, scoped to the
  requesting agent's own assigned beats/customers — not the whole
  catalog. This is a pragmatic MVP implementation (a fixed set of typed
  collections) rather than a fully generic per-table diff protocol;
  extending it table-by-table is straightforward.
- **Push** (`POST /api/sync/push/`): a batch of `{entity_type, payload}`
  items, each idempotent via `PushRequestLog` keyed on the payload's
  client-generated `id`. The server recomputes GST/totals from the item
  master — client-submitted totals are never trusted.
- **Credit-limit offline case**: an offline invoice is allowed to proceed
  even against a stale/locally-cached credit limit (hard offline
  requirement) but is re-validated server-side at sync time; a breach
  sets `credit_check_status=pending_review`, surfaced in the admin-web
  Credit-Block Approval queue rather than silently accepted or blocking
  the agent.

## Tally Prime integration

Tally's XML/HTTP interface is on-premise, unauthenticated, and not
reachable from a cloud backend. The design is a lightweight **on-prem
connector agent** (`backend/apps/integrations/connector_agent/agent.py`):

- Zero third-party dependencies (stdlib only) — simple enough to package
  as a single Windows-service executable for a client's office PC.
- **Polls outbound only** (`GET /api/integrations/connector/jobs/`), so
  nothing needs to be opened on the client's firewall.
- Authenticates with a shared per-deployment API key
  (`X-Connector-Key` header, not JWT).
- Is deliberately "dumb": builds Tally XML, posts to local Tally, reports
  the result back. All retry policy and deduplication lives centrally in
  Django via `SyncLogEntry` — the same job-queue contract can drive a
  Busy/Marg adapter later by swapping only the connector implementation
  (`apps/integrations/connectors/*.py`, implementing `BaseConnector`).
- **Celery + Redis** dispatch a job for real-time/mock mode; Postgres
  (`SyncLogEntry`) is the durable source of truth, so a Redis outage can't
  lose a sync job. Exponential backoff retry (1m→5m→15m→1h→hourly, capped
  at `SyncLogEntry.MAX_RETRIES`), surfaced in the admin-web Sync Monitor
  with manual retry/resolve actions.
- A **mock connector** (`connectors/mock.py`) simulates latency/failure so
  the full sync → retry → monitor loop is demonstrable without a real
  Tally instance — this is what the seeded demo deployment uses.

## Auth & RBAC

- `djangorestframework-simplejwt`: short-lived access token + rotating
  refresh. Mobile uses `Authorization: Bearer`; admin-web wraps the same
  tokens in HttpOnly cookies set by Next.js route handlers, so the token
  never touches browser JS.
- Custom RBAC (`apps.accounts.permissions.HasRolePermission`): string
  permission codes mapped to the BRD's 7 roles
  (`apps.accounts.constants.DEFAULT_ROLE_PERMISSIONS`), seeded per
  deployment and editable via the User & Role Management screens.
  Enforced at the action level (DRF permission class) and the object
  level (`get_queryset()` scoping — a Van Salesman only ever sees their
  own trips/invoices).

## What's deliberately out of scope for this build

This is the Phase 1 MVP slice per the BRD's own roadmap (Section 18), not
the full 3-phase spec:

- Real-time GPS breadcrumb tracking, route optimization, geofencing (Phase 2/3/Section 20 items)
- Barcode scanning, digital signature/OTP capture UI, multi-language UI
- Busy/Marg connectors (the connector interface is ready; only Tally is implemented)
- Full WatermelonDB per-table sync protocol (the pull endpoint is a pragmatic fixed-collection version)
- Automated central client registry (see `docs/PROVISIONING.md` — provisioning is manual/scripted per client for now)
- Payment gateway integration, e-way bill generation, WhatsApp integration (Section 20 future roadmap)
