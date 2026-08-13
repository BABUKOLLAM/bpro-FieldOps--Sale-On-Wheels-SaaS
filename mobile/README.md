# bpro FieldOps — Mobile (React Native)

Offline-first field sales app: WatermelonDB (SQLite) local store, JWT auth
gated by a device PIN/biometric lock, and a custom sync client against the
backend's `apps.mobile_sync` pull/push endpoints. See
[`../docs/architecture.md`](../docs/architecture.md) for the full design.

**Implemented in this reference build**: login, device PIN setup/unlock,
pull sync (customers/items/price lists/GST/van stock/beats/routes), Spot
Billing (fully offline, FR-01), Trip Start/End with outlet check-in/out
(fully offline, FR-08/FM-01), Expense capture (FR-06), barcode-scan-to-cart
(FR-13, a pure local lookup against the synced `items` table — no
backend round-trip), post-sale signature capture (FR-12, uploaded via a
separate multipart step once the parent record has synced), GPS point
capture at trip start/end and outlet check-in/out plus foreground
periodic breadcrumb tracking while a trip is active (FR-05/FM-02 — see
"Native permissions required" below for what real background tracking
would additionally need), daily attendance check-in/check-out with a
geo-tag (FR-16 — check-in is offline-first like everything else above;
check-out is a direct online call, deliberately not routed through the
offline push queue, since re-pushing an update through it would silently
no-op against the backend's push-idempotency log — see the note in
`sync/synchronize.ts`; selfie capture is explicitly "(optional)" in the
BRD's own wording and isn't built here), and push sync with retry-safe
idempotency. Receipt/Return/Order screens follow the identical WatermelonDB + sync
pattern used by Spot Billing — see
`src/screens/billing/SpotBillingScreen.tsx` as the template for adding
them.

## Native permissions required

Once `ios/`/`android/` are generated, these entries need adding (not yet
possible in this environment — no native projects exist here to edit):

- **Location** (`src/location/geo.ts`, `src/sync/locationTracking.ts`):
  Android `ACCESS_FINE_LOCATION` in `AndroidManifest.xml`; iOS
  `NSLocationWhenInUseUsageDescription` in `Info.plist`. Foreground
  tracking only — always-on background tracking would additionally need
  Android's foreground-service + notification setup and iOS's background
  location capability, neither of which this build attempts (see the
  scope note in `locationTracking.ts`).
- **Camera** (`react-native-camera-kit` for barcode scanning,
  `react-native-image-picker` for expense receipt photos): Android
  `CAMERA` permission; iOS `NSCameraUsageDescription` (and
  `NSPhotoLibraryUsageDescription` for the gallery-picker path).
- **Bluetooth** (`react-native-thermal-receipt-printer`, FR-03 receipt
  printing — `src/printing/bluetoothPrinter.ts`): Android
  `BLUETOOTH`/`BLUETOOTH_ADMIN` (and `BLUETOOTH_CONNECT` on Android 12+);
  iOS `NSBluetoothAlwaysUsageDescription`. Printing connects to the
  first already-paired BLE printer — pairing itself happens in the OS
  Bluetooth settings, not in-app.

## Receipt sharing & printing (FR-03 remainder)

`SpotBillingScreen`'s post-save step adds two actions alongside
signature/OTP: **Share Receipt** (React Native's built-in `Share` API —
no extra native module, opens the OS share sheet for SMS/WhatsApp/
email/etc) and **Print via Bluetooth** (`printing/bluetoothPrinter.ts`,
prints to the first paired thermal printer). Both build from the same
`printing/receiptText.ts` so the two outputs stay identical. Bluetooth
printing is unverified like every other native module here — no
Bluetooth hardware or native project to test against.

## Native project setup

`ios/` and `android/` native projects are checked into this repo and are
what `mobile-ios-ci` (GitHub Actions) builds and runs against the iOS
Simulator on every push — see `.github/workflows/mobile-ios-ci.yml` and
`mobile/e2e/salesman-flow.yaml` for the automated end-to-end coverage.
To run locally:

```bash
npm install
npx pod-install ios       # iOS only
npm run ios                # or: npm run android
```

CI's build is Simulator-only (ad-hoc signed, no provisioning profile) —
it cannot install on a real device. See
[`docs/DEVICE_TESTING.md`](docs/DEVICE_TESTING.md) for what physical
device testing still needs and why it's a separate, currently-unverified
step from what CI already proves.

## Multi-language UI (FR-17)

`src/i18n/` is a small hand-maintained dictionary (English + Hindi so
far — see `locales.ts`) plus a `LanguageProvider`/`useTranslation()`
context (`LanguageContext.tsx`), not a full i18n library — the app's
string surface is small enough that this is simpler to review and
extend. The chosen language persists via
`@react-native-async-storage/async-storage` and is switchable from the
pill button next to "Sign out" on the home screen. Currently wired into
navigation titles and the home screen; other screens still show
English strings and can be migrated the same way (add keys to both
locales in `locales.ts`, then `const { t } = useTranslation()` in the
screen).

## OTP proof-of-delivery (FR-12 remainder)

`SpotBillingScreen`'s post-save step now offers "Confirm via OTP instead"
alongside the existing signature capture. Unlike signature (captured
offline, uploaded whenever the invoice next syncs), OTP is inherently
online-only: the backend's `send-delivery-otp`/`verify-delivery-otp`
endpoints act on the invoice by its server id, so the flow pushes the
invoice via `synchronize()` first and surfaces a clear error ("needs an
internet connection — use signature instead") if that fails, rather than
silently hanging or pretending to work offline.

## Configuration

Edit `src/config.ts` to point at your backend (`API_BASE_URL`). For a real
per-client build, wire this through `react-native-config` instead of a
hardcoded constant, so the same source tree can be built once per client
with a different `.env` — see `docs/PROVISIONING.md`.

## Verification performed

`mobile-ios-ci` (GitHub Actions) now builds the app for the iOS
Simulator and runs the full salesman workflow end-to-end via Maestro on
every push (`mobile/e2e/salesman-flow.yaml`) — login, sync, trip
start, outlet check-in, a Spot Billing sale, and sync back. That
covers WatermelonDB persistence, Keychain, navigation, and UI rendering
under real (Simulator) conditions, not just typecheck. What it does
*not* cover — GPS accuracy, a real camera sensor, real Bluetooth
hardware, and real biometric sensors, none of which the Simulator can
genuinely exercise — is tracked separately in
[`docs/DEVICE_TESTING.md`](docs/DEVICE_TESTING.md).

The checks below predate CI and were the only verification possible
before native projects existed in this repo. Kept for the record —
several caught genuine pre-existing bugs, not just style issues:

- **`npm run typecheck` and `npm run lint` both pass clean.** Getting
  there caught genuine pre-existing bugs, not just style issues:
  - `tsconfig.json` was missing `experimentalDecorators`/
    `useDefineForClassFields`, which WatermelonDB's `@field`/`@text`/
    `@children` decorators require — every model failed to type-check
    (masked since `npm install` had never succeeded before to actually
    run the checker).
  - Every model's `sync_status` field was named `syncStatus`, which
    collides with WatermelonDB's own built-in (read-only) `Model.syncStatus`
    accessor — silently shadowing a framework-reserved property. Renamed
    to `localSyncStatus` throughout.
  - `TripScreen.tsx` imported `SYNC_PENDING` from the `Trip` model, which
    doesn't export it (it's defined on `Invoice`) — this constant was
    `undefined` at runtime for every trip/checkpoint save, meaning
    `sync_status` was being set to `undefined` instead of `'pending'`.
  - The generic `upsertCollection()` sync helper assumed every table has
    a single `server_id` column; `beat_customers` is a join table with no
    such column, so every pull-sync of route assignments would have
    thrown or duplicated rows. Given its own dedicated upsert function
    matching on `(beat_server_id, customer_server_id)`.
  - `PinLock.tsx`'s biometric-unlock check wrapped a type guard in
    `Boolean(...)` in a way that defeated TypeScript's narrowing (masking
    what would otherwise have been a real crash risk).
  - No `.prettierrc` existed, so `eslint --fix` was fighting the
    codebase's actual (consistent, single-quote) style against
    Prettier's default. Added one.
- A manual read-through of every file in `src/` against the backend's
  actual API contracts, from Phase 1. This caught and fixed a real bug:
  the Trip/TripCheckpoint serializers didn't accept a client-generated
  `id` and marked `status`/`start_time`/`end_time` read-only, which would
  have silently dropped exactly the fields the offline Trip Start/End
  flow needs to push (see `apps/fleet/serializers.py`).
- `backend/tests/test_smoke.py::test_mobile_push_trip_and_checkpoint` —
  simulates the mobile app's actual push payloads for `trip` and
  `trip_checkpoint` end-to-end against a live test database, asserting
  the fields round-trip correctly.
- `test_mobile_push_is_idempotent` and `test_expense_push_is_idempotent`
  — same for the Spot Billing invoice and Expense push flows.
- `test_invoice_signature_upload_via_multipart_patch` — confirms the
  backend accepts the exact multipart PATCH `sync/synchronize.ts`'s
  `uploadPendingAttachments()` sends, with no dedicated upload endpoint
  needed.
- `test_location_ping_push_is_idempotent` — same idempotency guarantee
  for the new GPS breadcrumb push flow from `locationTracking.ts`.

`npm run typecheck`/`npm run lint` were re-run clean after the GPS/route
work (Phase 2 slice 2) with no new issues.

All of the above pass as of this build. What's still unverified is
anything that needs real hardware rather than a Simulator — see
[`docs/DEVICE_TESTING.md`](docs/DEVICE_TESTING.md) for the checklist.
