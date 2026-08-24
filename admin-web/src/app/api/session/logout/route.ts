import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, authCookieOptions } from "@/lib/api";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Clearing must carry the exact same path/domain attributes the login
  // route set (see lib/api.ts authCookieOptions) — a delete with
  // different scope targets a *different* cookie, and the real session
  // would silently survive logout once AUTH_COOKIE_DOMAIN is in use.
  // Setting an empty value with maxAge 0 is the most interoperable way
  // to expire a cookie with explicit attributes.
  const cookieOptions = authCookieOptions();
  response.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
