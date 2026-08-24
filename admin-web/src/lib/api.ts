import { cookies } from "next/headers";
import { backendDispatcher } from "./backendDispatcher";

const API_BASE_URL_INTERNAL = process.env.API_BASE_URL_INTERNAL || "http://localhost:8000";

export const ACCESS_COOKIE = "vs_access";
export const REFRESH_COOKIE = "vs_refresh";

/**
 * One source of truth for auth-cookie attributes — the set (login) and
 * clear (logout) sides MUST agree on path/domain or the browser treats
 * them as different cookies and logout silently leaves the session
 * behind.
 *
 * sameSite is "lax", not "strict": with Strict, a top-level navigation
 * into the app from anywhere external (a link in an email, WhatsApp,
 * another site) arrives WITHOUT the session cookie, so an already
 * logged-in user gets bounced to /login — exactly the redirect problem
 * seen with emailed deep links. Lax still withholds cookies on
 * cross-site POSTs (the CSRF-relevant case; all our mutations are
 * same-origin fetch calls), while letting ordinary link-ins stay
 * signed in.
 *
 * AUTH_COOKIE_DOMAIN (optional, e.g. ".fieldopspro.in") widens the
 * cookie to every subdomain so one login works across the apex, www,
 * and app hosts, which all serve this same console. Unset = host-only
 * cookie, the pre-existing behavior.
 */
export function authCookieOptions() {
  const domain = process.env.AUTH_COOKIE_DOMAIN;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(domain ? { domain } : {}),
  };
}

/**
 * Server-side fetch to the Django API, forwarding the access token from
 * the HttpOnly cookie set at login (see app/api/session/login/route.ts).
 * The token never touches browser JS — every read here happens in a
 * Server Component or Route Handler.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;

  const response = await fetch(`${API_BASE_URL_INTERNAL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      // Django's SECURE_SSL_REDIRECT trusts this header (see
      // SECURE_PROXY_SSL_HEADER in production.py) to know a request
      // arrived over HTTPS, since it never terminates TLS itself. This
      // call reaches the backend directly over the internal Docker
      // network, bypassing Caddy/nginx (which would normally set this
      // header) — so without it, Django considers every internal call
      // insecure and redirects it to HTTPS forever. Safe to assert here:
      // the original client request this is fulfilling already came in
      // over HTTPS (enforced by Caddy in front of admin-web itself).
      "X-Forwarded-Proto": "https",
    },
    cache: "no-store",
    // See backendDispatcher.ts — fetch() to the backend by hostname
    // hangs on this VPS; this connects to its resolved IP directly.
    dispatcher: await backendDispatcher(API_BASE_URL_INTERNAL),
  } as RequestInit);

  return response;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(ACCESS_COOKIE)?.value);
}
