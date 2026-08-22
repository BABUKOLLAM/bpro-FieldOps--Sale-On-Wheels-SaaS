import { NextRequest, NextResponse } from "next/server";
import { backendDispatcher } from "@/lib/backendDispatcher";

const API_BASE_URL_INTERNAL = process.env.API_BASE_URL_INTERNAL || "http://localhost:8000";

/**
 * Proxies the public sign-up form to Django's unauthenticated
 * POST /api/signup-requests/ endpoint — no cookie/token involved, unlike
 * session/login, since a signup request isn't a logged-in action at all.
 * Kept as a same-origin route (rather than the browser hitting
 * NEXT_PUBLIC_API_BASE_URL directly) purely for consistency with every
 * other admin-web write and to avoid a CORS round trip.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  const backendResponse = await fetch(`${API_BASE_URL_INTERNAL}/api/signup-requests/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // See lib/backendDispatcher.ts — fetch() to the backend by hostname
    // hangs on this VPS; this connects to its resolved IP directly.
    dispatcher: await backendDispatcher(API_BASE_URL_INTERNAL),
  } as RequestInit);

  const data = await backendResponse.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendResponse.status });
}
