# Van Sales — Mobile (React Native)

Offline-first field sales app: WatermelonDB (SQLite) local store, JWT auth
gated by a device PIN/biometric lock, and a custom sync client against the
backend's `apps.mobile_sync` pull/push endpoints. See
[`../docs/architecture.md`](../docs/architecture.md) for the full design.

**Implemented in this reference build**: login, device PIN setup/unlock,
pull sync (customers/items/price lists/GST/van stock/beats), Spot Billing
(fully offline, FR-01), Trip Start/End with outlet check-in/out (fully
offline, FR-08/FM-01), and push sync with retry-safe idempotency.
Receipt/Return/Order screens follow the identical WatermelonDB + sync
pattern used by Spot Billing — see `src/screens/billing/SpotBillingScreen.tsx`
as the template for adding them.

## Native project setup

This repo ships the **JavaScript/TypeScript source only** — `ios/` and
`android/` native projects are not included, since generating them
requires Xcode/CocoaPods or Android Studio/Gradle, which weren't available
in the environment this was built in. To get a runnable app:

```bash
npm install
npx react-native init TempScaffold --version 0.74.5   # on a machine with Xcode/Android Studio
# copy the generated ios/ and android/ folders from TempScaffold into this directory
```

Or use `@react-native-community/cli`'s `config` output as a reference and
hand-wire the native projects. Once `ios/`/`android/` exist:

```bash
npx pod-install ios       # iOS only
npm run ios                # or: npm run android
```

## Configuration

Edit `src/config.ts` to point at your backend (`API_BASE_URL`). For a real
per-client build, wire this through `react-native-config` instead of a
hardcoded constant, so the same source tree can be built once per client
with a different `.env` — see `docs/PROVISIONING.md`.

## Verification performed in this environment

Neither a native toolchain (Xcode/Android Studio) nor a working `npm
install` were available in the environment this was built in — `npm
install` was attempted three times and stalled/failed each time on slow
registry connectivity, so `npm run typecheck`/`npm run lint` could not be
run here. **Run them yourself as the first step** once dependencies
install cleanly in your environment; do not treat this source as verified
until they pass.

What *was* verified, from the backend side, since the mobile app has no
business logic of its own beyond the sync client (the server is always
the source of truth for money/GST/stock — see `docs/architecture.md`):

- A manual read-through of every file in `src/` against the backend's
  actual API contracts. This caught and fixed a real bug: the Trip/
  TripCheckpoint serializers didn't accept a client-generated `id` and
  marked `status`/`start_time`/`end_time` read-only, which would have
  silently dropped exactly the fields the offline Trip Start/End flow
  needs to push (see `apps/fleet/serializers.py`).
- `backend/tests/test_smoke.py::test_mobile_push_trip_and_checkpoint` —
  simulates the mobile app's actual push payloads for `trip` and
  `trip_checkpoint` end-to-end against a live test database, asserting
  the fields round-trip correctly. Passes as of this build.
- `test_mobile_push_is_idempotent` — same for the Spot Billing invoice
  push flow.

Full on-device behavior (WatermelonDB persistence, Keychain, navigation,
UI rendering) still needs verification on a simulator/device once
`npm install` and the native projects are in place.
