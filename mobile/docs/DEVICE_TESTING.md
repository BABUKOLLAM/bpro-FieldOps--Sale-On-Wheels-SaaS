# Physical device testing

CI (`mobile-ios-ci`) proves the app builds, launches, and completes the
full salesman workflow — but only on the **iOS Simulator**
(`-sdk iphonesimulator`, ad-hoc signed, no provisioning profile). A
simulator build cannot install on a real iPhone/iPad (different
architecture, no real device signing), and the Simulator itself fakes or
skips several things a real device doesn't: GPS is a scripted route
rather than a live fix, there's no real Bluetooth radio, no real camera
sensor, and biometric prompts are simulated menu items rather than an
actual Face ID/Touch ID sensor. Everything below is genuinely unverified
until it's run on real hardware — this doc exists so that verification is
a checklist, not ad-hoc poking once a device is available.

## Getting a build onto a device

Needs a Mac with **full Xcode** (not just command-line tools —
`xcode-select -p` should point at `/Applications/Xcode.app/...`) for iOS,
or Android Studio / just `adb` for Android. Neither requires a paid Apple
Developer account for local device testing:

**iOS**
1. `cd mobile && npx pod-install ios` (if `Pods/` isn't already present).
2. Open `ios/VanSales.xcworkspace` in Xcode.
3. Connect the iPhone by USB (or pair over Wi-Fi in Xcode's Devices
   window), select it as the run destination.
4. Xcode → Settings → Accounts → sign in with any Apple ID → in the
   project's Signing & Capabilities tab, set the Team to your personal
   team. Xcode generates a free, auto-renewing development provisioning
   profile — good for 7 days per install, no paid account needed.
5. On the device: Settings → General → VPN & Device Management → trust
   the developer certificate the first time.
6. Hit Run in Xcode.

**Android**
1. Enable Developer Options + USB debugging on the device, connect by
   USB, `adb devices` should list it.
2. `cd mobile && npm run android` — Metro + Gradle build + install in one
   step, same as the simulator flow.

## Backend reachability

The device needs to reach the backend over the network — `localhost`
inside `src/config.ts`'s `API_BASE_URL` only resolves on the device
itself, not your dev machine. Point it at your machine's LAN IP (same
Wi-Fi network) or a tunneled/deployed backend before testing, per
`docs/DEPLOYMENT.md`.

## Test script

Run the same salesman flow CI automates (`mobile/e2e/salesman-flow.yaml`
is a readable reference for the exact steps/order), but pay specific
attention to the things only real hardware can prove:

### Location (`src/location/geo.ts`, `src/sync/locationTracking.ts`)
- [ ] First launch prompts for location permission with the expected
      rationale text (`NSLocationWhenInUseUsageDescription` on iOS,
      `ACCESS_FINE_LOCATION` on Android) — not a silent failure.
- [ ] Denying permission doesn't crash trip start/check-in/check-out —
      confirm these stay "best-effort" as designed (see the comments in
      `TripScreen.tsx`), not a hard requirement.
- [ ] Start Trip / outlet check-in / check-out each capture a real GPS
      fix (compare the coordinates synced to the backend against actual
      physical location, not `0,0` or a stale/cached value).
- [ ] Foreground breadcrumb tracking during an active trip produces
      periodic `location_pings` rows while walking/driving a real route
      — check the Live Map admin-web page against actual movement.
- [ ] Backgrounding the app mid-trip: confirm tracking behavior matches
      what's documented (foreground-only in this build — verify it
      actually stops rather than silently misbehaving, since that's the
      one thing a simulator's scripted GPS can't reveal either way).

### Camera (`react-native-camera-kit`, `react-native-image-picker`)
- [ ] Barcode scan in Spot Billing (Scan Barcode button) actually reads
      a real printed/screen barcode and adds the matching catalog item —
      test at least one real product barcode, not just a generated test
      code.
- [ ] Scanning an unrecognized barcode fails gracefully (clear message,
      no crash).
- [ ] Expense receipt photo capture (camera + gallery picker paths both)
      attaches and later uploads correctly.
- [ ] Camera permission prompt/denial behavior, same check as location.

### Bluetooth thermal printing (`src/printing/bluetoothPrinter.ts`)
- [ ] Pair a real BLE thermal printer in the OS Bluetooth settings first
      (the app connects to the first already-paired printer — it doesn't
      do in-app pairing).
- [ ] "Print via Bluetooth" after a Spot Billing sale produces a
      physically correct, legible receipt matching `Share Receipt`'s text
      (both build from the same `printing/receiptText.ts` — confirm they
      actually match on paper, not just in code).
- [ ] No paired printer: confirm a clear error rather than a silent hang
      or crash.

### Biometric unlock (`PinLock.tsx`)
- [ ] Face ID / Touch ID (or Android BiometricPrompt) actually unlocks
      the app after PIN setup, using the real sensor — this is exactly
      the code path flagged in the README as previously having a
      TypeScript narrowing bug that "would otherwise have been a real
      crash risk"; confirm it isn't one on a real sensor.
- [ ] Biometric failure/cancel falls back to PIN entry correctly.

### Everything else worth a real-hardware pass
- [ ] Push notifications (FCM) actually arrive and open the right screen
      when tapped, backgrounded and foregrounded.
- [ ] OTP delivery-confirmation flow (SMS) — real SMS arrives with a
      usable code.
- [ ] Sync behavior across a real network transition (Wi-Fi → cellular,
      or airplane mode → reconnect) — confirm the offline-first queue
      actually recovers instead of just looking correct against a stable
      simulator network.
- [ ] Full salesman flow end-to-end on the actual target hardware specs
      (older/lower-end Android devices in particular, if that's part of
      the real fleet) — screen sizes, keyboard behavior, and performance
      the Simulator's fixed viewport can't represent.

## Recording results

There's no automated capture for this (unlike CI's Maestro screenshots)
— note pass/fail per item above, device model + OS version, and file
anything broken as a normal bug with repro steps, same as any other
finding this project tracks.
