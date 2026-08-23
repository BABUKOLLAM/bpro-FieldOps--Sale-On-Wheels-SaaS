import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/api";

// "/" is the public marketing/pricing landing page, "/signup" is the
// public self-service access-request form, "/forgot-password" and
// "/set-password" are the "forgot password" request form and the
// one-time link it (and signup approval) leads to — none of these
// require a session. Everything else in the (dashboard) route group
// does.
const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/forgot-password", "/set-password"]);

export function proxy(request: NextRequest) {
  const isAuthenticated = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && !PUBLIC_PATHS.has(pathname)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  if (isAuthenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals, and any path with a file extension —
  // covers favicon.ico, manifest.webmanifest, sw.js, /icons/*.png, and
  // the bpro logo assets, none of which should ever redirect to /login.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
