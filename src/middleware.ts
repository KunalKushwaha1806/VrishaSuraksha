import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every request:
 * 1. CSRF: state-changing API calls must come from this site's own origin.
 *    (Session cookies are also SameSite=Lax.) The scheduler endpoint is
 *    exempt because it authenticates with a bearer secret instead.
 * 2. CSP: a fresh nonce per request so only our own scripts can run.
 */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_EXEMPT = ["/api/cron/"];

function expectedHost(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-host") ?? req.headers.get("host");
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === expectedHost(req);
  } catch {
    return false;
  }
}

function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (MUTATING.has(req.method) && !CSRF_EXEMPT.some((p) => pathname.startsWith(p)) && !sameOrigin(req)) {
      return NextResponse.json({ error: { code: "forbidden", message: "Cross-site request blocked." } }, { status: 403 });
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV !== "production");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
