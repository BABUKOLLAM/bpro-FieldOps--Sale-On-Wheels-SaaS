import { NextRequest, NextResponse } from "next/server";
import { backendDispatcher } from "@/lib/backendDispatcher";

const API_BASE_URL_INTERNAL = process.env.API_BASE_URL_INTERNAL || "http://localhost:8000";

/**
 * Proxies "forgot password" requests to Django's unauthenticated
 * POST /api/auth/password-reset/ — no cookie/token involved, same as
 * session/signup-request, since the person isn't logged in. Always
 * returns the same generic response regardless of whether the email
 * matches an account (see PasswordResetRequestView) — this route just
 * passes that through unchanged.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  const backendResponse = await fetch(`${API_BASE_URL_INTERNAL}/api/auth/password-reset/`, {
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

  const data = await backendResponse.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendResponse.status });
}
