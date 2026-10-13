import { NextResponse, type NextRequest } from "next/server";

/** Per-request CSP nonce (pages are dynamically rendered, so Next.js applies it to its scripts). */
export function proxy(request: NextRequest) {
  // btoa rather than Buffer: on Netlify the proxy runs as an Edge Function.
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";
  const secure = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Next.js's development tools inject styles without the nonce. A nonce would make browsers ignore
    // 'unsafe-inline', so development drops it; production keeps the nonce (checked in e2e/http.spec.ts).
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`} https://fonts.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(secure ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|apple-touch-icon.png|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
