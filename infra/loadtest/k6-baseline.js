/**
 * Baseline load test — answers the audit item "load testing is still
 * required for API, database, and frontend traffic" with a repeatable,
 * pass/fail measurement instead of a one-off eyeball run.
 *
 * Tool: k6 (https://k6.io — single binary, no repo dependency).
 *
 * Run (ALWAYS against staging, or production only in an agreed
 * low-traffic window — this generates real sustained traffic):
 *
 *   k6 run \
 *     -e APP_URL=https://staging.example.com \
 *     -e API_URL=https://api-staging.example.com \
 *     -e LOGIN_USERNAME=loadtest@example.com \
 *     -e LOGIN_PASSWORD='...' \
 *     infra/loadtest/k6-baseline.js
 *
 * Use a dedicated load-test account (any role), never a real person's.
 * The run FAILS (non-zero exit) if the thresholds below are breached —
 * wire it into CI against staging, or run before each major release.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const APP_URL = __ENV.APP_URL || "https://fieldopspro.in";
const API_URL = __ENV.API_URL || "https://api.fieldopspro.in";
const USERNAME = __ENV.LOGIN_USERNAME || "";
const PASSWORD = __ENV.LOGIN_PASSWORD || "";

export const options = {
  scenarios: {
    // Anonymous browsing: landing + login page + API health. Exercises
    // Caddy -> nginx -> admin-web SSR and the backend health path.
    anonymous: {
      executor: "ramping-vus",
      exec: "anonymous",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 10 },
        { duration: "3m", target: 25 },
        { duration: "1m", target: 0 },
      ],
    },
    // Authenticated API traffic: JWT login once per VU, then repeated
    // reads of the endpoints the console dashboard actually calls.
    // Exercises Django + Postgres under concurrency.
    authenticated: {
      executor: "ramping-vus",
      exec: "authenticated",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 5 },
        { duration: "3m", target: 15 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    // Release gates — tune deliberately, never delete to make a run pass.
    http_req_failed: ["rate<0.01"],                  // <1% errors
    "http_req_duration{kind:page}": ["p(95)<2000"],  // SSR pages p95 < 2s
    "http_req_duration{kind:api}": ["p(95)<800"],    // API reads p95 < 800ms
    "http_req_duration{kind:health}": ["p(95)<300"],
  },
};

export function anonymous() {
  const pages = [
    [`${APP_URL}/`, "page"],
    [`${APP_URL}/login`, "page"],
    [`${API_URL}/healthz/`, "health"],
  ];
  for (const [url, kind] of pages) {
    const res = http.get(url, { tags: { kind } });
    check(res, { [`${url} is 200`]: (r) => r.status === 200 });
    sleep(1);
  }
}

export function authenticated() {
  if (!USERNAME || !PASSWORD) {
    // No credentials supplied — skip rather than report fake success.
    return;
  }
  const login = http.post(
    `${API_URL}/api/auth/login/`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" }, tags: { kind: "api" } },
  );
  const ok = check(login, { "login 200": (r) => r.status === 200 });
  if (!ok) { sleep(5); return; }

  const token = login.json("access");
  const auth = { headers: { Authorization: `Bearer ${token}` }, tags: { kind: "api" } };

  // The reads the console dashboard/users pages actually issue.
  for (const path of ["/api/me/", "/api/users/", "/api/roles/"]) {
    const res = http.get(`${API_URL}${path}`, auth);
    check(res, { [`${path} is 200`]: (r) => r.status === 200 });
    sleep(1);
  }
}
