import { NextRequest, NextResponse } from "next/server";
import { backendDispatcher } from "@/lib/backendDispatcher";

const API_BASE_URL_INTERNAL = process.env.API_BASE_URL_INTERNAL || "http://localhost:8000";

/**
 * Proxies the read-only "whose account is this set-password link for"
 * lookup to Django's unauthenticated GET /api/auth/set-password/lookup/
 * — lets the /set-password page confirm the account before asking for
 * a password, and fail fast on a dead link instead of only discovering
 * that after the form is filled in and submitted.
 */
export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;

  const backendResponse = await fetch(`${API_BASE_URL_INTERNAL}/api/auth/set-password/lookup/${search}`, {
    method: "GET",
    // See lib/api.ts's apiFetch for why X-Forwarded-Proto is set here —
    // Django's SECURE_SSL_REDIRECT otherwise redirect-loops this
    // internal, Caddy/nginx-bypassing call forever.
    headers: { "X-Forwarded-Proto": "https" },
    cache: "no-store",
    // See lib/backendDispatcher.ts — fetch() to the backend by hostname
    // hangs on this VPS; this connects to its resolved IP directly.
    dispatcher: await backendDispatcher(API_BASE_URL_INTERNAL),
  } as RequestInit);

  const data = await backendResponse.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendResponse.status });
}
