import { defineConfig } from "@playwright/test";

/**
 * E2E suite for the console's critical user flows (e2e/*.spec.ts) —
 * the layer where unit/API tests can't see bugs: real browser against
 * the real Next.js server proxying to a real Django backend. Every
 * regression this suite guards against (login round trip, the
 * signup -> approve -> set-password lifecycle, proxy-route behavior,
 * auth-cookie redirects) shipped broken at least once before it existed.
 *
 * Both servers are booted automatically:
 *  - backend: scripts/run_e2e_backend.sh — recreates a dedicated
 *    vansales_e2e database, migrates, seeds roles + a known admin
 *    (config.settings.e2e; never touches the dev database),
 *  - admin-web: production build via `next start` (closest to what
 *    actually deploys), pointed at the E2E backend.
 *
 * Run locally:  npm run e2e   (Postgres must be running on :5432)
 */
const BACKEND_PORT = 8100;
const WEB_PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // The signup lifecycle mutates shared state (one admin approving);
  // serial keeps runs deterministic. The suite is small — parallelism
  // isn't worth the flake risk.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "bash ../backend/scripts/run_e2e_backend.sh",
      url: `http://localhost:${BACKEND_PORT}/healthz/`,
      reuseExistingServer: false,
      stdout: "pipe",
      timeout: 120_000,
      env: {
        E2E_BACKEND_PORT: String(BACKEND_PORT),
        // set-password links are built server-side from this (see
        // build_set_password_url) — must point at the E2E web server.
        FRONTEND_BASE_URL: `http://localhost:${WEB_PORT}`,
      },
    },
    {
      // Build at NODE_ENV=production (the default — a real production
      // artifact), then prefix ONLY `next start` with NODE_ENV=development.
      // That single flag relaxes the auth cookies' Secure attribute
      // (authCookieOptions keys it off NODE_ENV) so the session persists
      // over plain-http E2E; a browser drops Secure cookies over http.
      // Real deployments run over https where Secure correctly holds.
      command: `npm run build && NODE_ENV=development npx next start -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: false,
      stdout: "pipe",
      timeout: 180_000,
      env: {
        // 127.0.0.1, not localhost: backendDispatcher resolves the host
        // and dials the IP, and localhost resolves to IPv6 ::1 while
        // Django's runserver binds IPv4 only. Production uses the Docker
        // service name "backend" (IPv4 via Docker DNS), so this is an
        // E2E-only concern.
        API_BASE_URL_INTERNAL: `http://127.0.0.1:${BACKEND_PORT}`,
        NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${BACKEND_PORT}`,
      },
    },
  ],
});
