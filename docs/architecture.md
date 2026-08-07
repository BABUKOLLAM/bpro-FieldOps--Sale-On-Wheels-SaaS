# Architecture

Phase 1 MVP + Phase 2 slices 1-3 of the Field Sales / Van Sales SaaS
platform. This document covers what's implemented, the key design
decisions, and what's deliberately deferred beyond this build.

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
| `catalog` | Items, UOM, price lists, scheme/discount engine (flat, percent, slab) |
| `customers` | Customers (credit limit/outstanding/blocked), beats/routes |
| `sales` | SalesOrder, Invoice, Receipt, CreditNote — GST calc, credit checks, stock posting |
| `inventory` | Godowns, the stock ledger (source of truth), van load/unload with variance |
| `fleet` | Vehicles, trips, checkpoints, odometer/fuel logs, maintenance + due-alerts, GPS breadcrumbs, fleet dashboard |
| `expenses` | Field expense capture + supervisor approval workflow |
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

## Phase 2, slice 1: sales-side essentials

Added on top of the Phase 1 MVP:

- **Scheme engine — slab/volume discounts** (FR-14): `catalog.SchemeSlab`
  adds quantity-tiered discounts (e.g. 10–49 units → 5% off, 50+ → 10%)
  alongside the existing flat/percent scheme type, evaluated in
  `sales.services.best_scheme_discount()`. BXGY ("buy X get Y") is a
  different mechanic — a bonus invoice line, not a discount on an
  existing one — and remains out of scope.
- **Expense tracking + approval** (FR-06, AR-10): new `apps.expenses` app,
  following the identical pattern as `sales`/`fleet` — client-generated
  UUID PK, `agent`-scoped queryset, `approve`/`reject` actions, wired into
  the mobile push protocol and a new Expense Approvals section in
  admin-web's Approvals page.
- **Digital signature capture** (FR-12): `Invoice.signature_image`
  (already present in Phase 1) is populated from the mobile app via a
  separate multipart `PATCH` after the invoice's JSON push succeeds — no
  new backend endpoint needed, confirmed by
  `test_invoice_signature_upload_via_multipart_patch`. OTP-based proof of
  delivery is **not** implemented — a real OTP needs an SMS/WhatsApp
  gateway, which the BRD itself places in Phase 4 (Section 20.2);
  signature capture is the complete FR-12 implementation for now.
- **Barcode scanning** (FR-13): mobile-only — `Item.barcode` was already
  synced to the local WatermelonDB `items` table in Phase 1, so
  scan-to-cart is a pure offline local-DB lookup with zero backend
  round-trip.

## Phase 2, slice 2: GPS tracking + route/beat planning

Added on top of slice 1:

- **GPS point capture** (FR-05, FM-02): `fleet.Trip` and
  `fleet.TripCheckpoint` already had lat/lng columns from Phase 1 — this
  slice is the mobile app actually populating them, at trip start/end and
  outlet check-in/out, best-effort (a location failure never blocks the
  action, same principle as offline credit checks).
- **Foreground periodic breadcrumb tracking**: new `fleet.LocationPing`
  model (client-generated UUID PK, same idempotency pattern as every
  other mobile-pushed entity), populated by
  `mobile/src/sync/locationTracking.ts` on a 3-minute interval while a
  trip is in progress and the app is foregrounded. **Not** a background
  service — true always-on tracking needs native project configuration
  (Android foreground service + notification, iOS background location
  mode) not attempted here; see `mobile/README.md`. Deliberately
  unpartitioned — a production deployment at scale should partition this
  table by month and define a retention policy (noted in the model, not
  built).
- **Route/beat planning UI** (AR-08): `customers.Beat`/`BeatCustomer`
  already existed as models from Phase 1 with no admin-web screen to
  manage them (Django admin only). Added `BeatCustomerViewSet` (stop
  CRUD) and a Routes section on admin-web's Master Data page.
- **Live map** (AR-03): new `reporting.LiveMapView` joins each in-progress
  trip's agent, latest `LocationPing` (falling back to the trip's own
  start location), and beat-stop visit status server-side, rendered on a
  new admin-web `/live-map` page with `react-leaflet` + OpenStreetMap
  tiles (no Google Maps API key/billing account required).

## Phase 2, slice 3: fleet expansion

Added on top of slice 2 (FM-05, FM-07, FM-08, FM-11, FM-12, FM-13):

- **Maintenance due-alerts** (FM-05): `fleet.MaintenanceSchedule` already
  had `next_due_date`/`next_due_odometer` from Phase 1 with nothing
  computing "is this due" — `fleet.services.maintenance_due_alerts()`
  fills that gap (ok/due_soon/overdue, by date or odometer, whichever is
  closer).
- **Reverse logistics — a real audit-trail bug fix, not just a new
  feature** (FM-11): `sales.services.finalize_credit_note()` previously
  posted a `StockLedgerEntry` only for `condition=sellable` returns —
  damaged/expired returns had **zero record** of ever entering the van.
  Now posts for every condition; `CreditNoteLine.condition` remains the
  field downstream reconciliation reads.
- **Route optimization** (FM-07): `BeatViewSet.optimize_route` —
  nearest-neighbor stop re-ordering by Haversine (straight-line) distance
  between `CustomerAddress` coordinates. Explicitly not a capacity/
  traffic-aware vehicle-routing solver; stops with no address on file are
  left in their existing order.
- **Fleet Dashboard** (FM-08, FM-12, FM-13): new `fleet.FleetDashboardView`
  — per-vehicle trip count/distance/fuel-cost/efficiency (30d, from data
  already captured in Phase 1: `Trip.distance_travelled`, `FuelLog`),
  maintenance alerts, a 6-month fuel-cost trend, and a reverse-logistics
  reconciliation view (damaged/expired credit note lines cross-referenced
  against van-unload stock transfers as a proxy "returned to warehouse"
  signal). Rendered on a new admin-web `/fleet` page with CSV export per
  table (a practical substitute for FM-13's "Excel/PDF and emailable,"
  which would need real document-generation + email infrastructure this
  slice doesn't build). "Idle time"/"route-deviation" analytics and FM-16
  "compliance status" (vehicle document/insurance/PUC expiry — not built)
  are both omitted rather than faked.

## What's deliberately out of scope for this build

Beyond the BRD's own Phase 1/Phase 2 slice boundaries (Section 18):

- Route optimization beyond the nearest-neighbor heuristic above, geofencing (Phase 3/Section 20 items)
- True background GPS tracking (native project config not attempted here — see slice 2), idle-time/route-deviation analytics, OTP-based proof of delivery, multi-language UI
- Third-party GPS/telematics hardware integration (FM-06) and vehicle document/compliance expiry tracking (FM-16) — no vendor hardware/API to integrate with, and FM-16 is a Phase 3 item respectively
- Busy/Marg connectors (the connector interface is ready; only Tally is implemented)
- Full WatermelonDB per-table sync protocol (the pull endpoint is a pragmatic fixed-collection version)
- Automated central client registry (see `docs/PROVISIONING.md` — provisioning is manual/scripted per client for now)
- Payment gateway integration, e-way bill generation, WhatsApp integration (Section 20 future roadmap)
- Server-side Excel/PDF report generation + email delivery (CSV export substituted)
- Busy/Marg integration — the one remaining Phase 2 slice, not started
