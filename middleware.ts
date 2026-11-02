import { NextResponse, type NextRequest } from "next/server";

/**
 * Content Security Policy.
 * - Checkout, confirmation and host pages: strict nonce-based policy (no inline scripts at all).
 * - Other pages are statically generated, so they keep 'unsafe-inline' for Next.js’s own
 *   bootstrap scripts; there are still no third-party scripts anywhere on the site.
 * Card details are only ever entered on Stripe’s own page (checkout.stripe.com).
 */
const SENSITIVE = /^\/(checkout|host|admin)(\/|$)/;
const dev = process.env.NODE_ENV === "development";

function policy(scripts: string) {
  return [
    "default-src 'self'",
    `script-src ${scripts}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "frame-src https://www.openstreetmap.org",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const sensitive = SENSITIVE.test(request.nextUrl.pathname);
  if (!sensitive) {
    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", policy("'self' 'unsafe-inline'"));
    return response;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = policy(`'self' 'nonce-${nonce}' 'strict-dynamic'`);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|photos/|brand/|icon.svg|apple-icon.png|robots.txt|sitemap.xml).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
