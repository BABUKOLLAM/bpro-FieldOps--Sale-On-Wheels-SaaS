import { cookies } from "next/headers";
import { backendDispatcher } from "./backendDispatcher";

const API_BASE_URL_INTERNAL = process.env.API_BASE_URL_INTERNAL || "http://localhost:8000";

export const ACCESS_COOKIE = "vs_access";
export const REFRESH_COOKIE = "vs_refresh";

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
