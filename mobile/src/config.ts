/**
 * Per-client deployment config.
 *
 * `__DEV__` is React Native's build-type flag: true for debug builds
 * (local `npm run android/ios`, and the CI emulator/simulator runs that
 * drive the app against a backend on the runner's own localhost via
 * Metro), false for release builds (the signed APK mobile-android-ci
 * publishes, and any App Store / Play build). Keying the API origin on
 * it means the dev loop and CI E2E keep hitting localhost unchanged,
 * while every release binary targets production without a separate
 * build step or a native env-var module.
 *
 * Production host: api.fieldopspro.in — the backend subdomain from
 * docs/DEPLOYMENT.md §1 (nginx routes it to Django; admin-web lives on
 * app.fieldopspro.in). If this app is ever built for a second client on
 * a different backend, move this to react-native-config so one source
 * tree builds once per client — see docs/PROVISIONING.md.
 */
export const API_BASE_URL = __DEV__
  ? 'http://localhost:8000'
  : 'https://api.fieldopspro.in';
