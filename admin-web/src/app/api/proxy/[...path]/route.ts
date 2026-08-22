import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/lib/api";
import { backendDispatcher } from "@/lib/backendDispatcher";

const API_BASE_URL_INTERNAL = process.env.API_BASE_URL_INTERNAL || "http://localhost:8000";

/**
 * Generic authenticated proxy: client components call
 * `/api/proxy/<django-path>` instead of the Django API directly, so the
 * access token (HttpOnly cookie) never has to be exposed to browser JS.
 * Used for the mutations on the Approvals/Sync Monitor and Master Data
 * screens (approve credit, retry sync, create/update customer or item).
 */
async function forward(request: NextRequest, path: string[]) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const targetPath = `/api/${path.join("/")}/`;
  const search = request.nextUrl.search;
  const hasBody = !["GET", "HEAD"].includes(request.method);
  // File uploads (e.g. Company logo) arrive as multipart/form-data — must
  // NOT be forced through .text()/JSON, and must NOT get an explicit
  // Content-Type header here: fetch() derives the correct
  // "multipart/form-data; boundary=..." from the FormData body itself,
  // and a stale boundary-less header would break Django's parser.
  const isMultipart = (request.headers.get("content-type") || "").includes("multipart/form-data");

  const backendResponse = await fetch(`${API_BASE_URL_INTERNAL}${targetPath}${search}`, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isMultipart ? {} : { "Content-Type": "application/json" }),
    },
    body: hasBody ? (isMultipart ? await request.formData() : await request.text()) : undefined,
    cache: "no-store",
    // See lib/backendDispatcher.ts — fetch() to the backend by hostname
    // hangs on this VPS; this connects to its resolved IP directly.
    dispatcher: await backendDispatcher(API_BASE_URL_INTERNAL),
  } as RequestInit);

  const contentType = backendResponse.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await backendResponse.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendResponse.status });
  }
  if (contentType.includes("text/")) {
    // e.g. CSV downloads — preserve the real content-type and filename
    // instead of defaulting to text/plain, or the browser won't offer a
    // proper file save with the right name/extension.
    const headers = new Headers({ "content-type": contentType });
    const disposition = backendResponse.headers.get("content-disposition");
    if (disposition) headers.set("content-disposition", disposition);
    return new NextResponse(await backendResponse.text(), { status: backendResponse.status, headers });
  }
  // Binary payloads (xlsx/pdf report downloads, etc.) — .text() would
  // corrupt these, so read as raw bytes and preserve the filename header.
  const buffer = await backendResponse.arrayBuffer();
  const headers = new Headers({ "content-type": contentType || "application/octet-stream" });
  const disposition = backendResponse.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  return new NextResponse(buffer, { status: backendResponse.status, headers });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await params).path);
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await params).path);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await params).path);
}
