import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, authCookieOptions } from "@/lib/api";
import { backendDispatcher } from "@/lib/backendDispatcher";

const API_BASE_URL_INTERNAL = process.env.API_BASE_URL_INTERNAL || "http://localhost:8000";

/**
 * Proxies login to the Django API and stores the returned JWTs as
 * HttpOnly/Secure/SameSite=Strict cookies — the browser never sees the
 * token value itself, only this same-origin route can read it back out.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  const backendResponse = await fetch(`${API_BASE_URL_INTERNAL}/api/auth/login/`, {
    method: "POST",
    // See lib/api.ts's apiFetch for why X-Forwarded-Proto is set here —
    // Django's SECURE_SSL_REDIRECT otherwise redirect-loops this
    // internal, Caddy/nginx-bypassing call forever.
    headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" },
    body: JSON.stringify(body),
    // See lib/backendDispatcher.ts — fetch() to the backend by hostname
    // hangs on this VPS; this connects to its resolved IP directly.
    dispatcher: await backendDispatcher(API_BASE_URL_INTERNAL),
  } as RequestInit);

  if (!backendResponse.ok) {
    const errorBody = await backendResponse.json().catch(() => ({}));
    return NextResponse.json(errorBody, { status: backendResponse.status });
  }

  const data = await backendResponse.json();
  const response = NextResponse.json({ user: data.user });

  // See lib/api.ts authCookieOptions for why sameSite is lax and how
  // AUTH_COOKIE_DOMAIN scopes the session across apex/www/app hosts.
  const cookieOptions = authCookieOptions();

  response.cookies.set(ACCESS_COOKIE, data.access, { ...cookieOptions, maxAge: 60 * 15 });
  response.cookies.set(REFRESH_COOKIE, data.refresh, { ...cookieOptions, maxAge: 60 * 60 * 24 * 14 });

  return response;
}
