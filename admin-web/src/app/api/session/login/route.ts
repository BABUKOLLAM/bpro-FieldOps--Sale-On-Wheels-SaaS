import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/api";

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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!backendResponse.ok) {
    const errorBody = await backendResponse.json().catch(() => ({}));
    return NextResponse.json(errorBody, { status: backendResponse.status });
  }

  const data = await backendResponse.json();
  const response = NextResponse.json({ user: data.user });

  const isProduction = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict" as const,
    path: "/",
  };

  response.cookies.set(ACCESS_COOKIE, data.access, { ...cookieOptions, maxAge: 60 * 15 });
  response.cookies.set(REFRESH_COOKIE, data.refresh, { ...cookieOptions, maxAge: 60 * 60 * 24 * 14 });

  return response;
}
