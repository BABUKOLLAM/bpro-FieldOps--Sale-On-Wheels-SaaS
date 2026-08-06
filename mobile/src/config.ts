/**
 * Per-client deployment config. `API_BASE_URL` should be set at build
 * time via `react-native-config` (or similar) for a real client build —
 * see docs/PROVISIONING.md "Onboard users" step. Hardcoded to localhost
 * here for the reference/demo build (works against the docker-compose
 * backend when running on an emulator with the standard host-loopback
 * mapping, e.g. 10.0.2.2 on Android — override per platform as needed).
 */
export const API_BASE_URL = 'http://localhost:8000';
