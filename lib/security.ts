import { NextResponse } from "next/server";

/**
 * Request-level protections shared by every API route that changes something.
 *
 * - sameOrigin: blocks cross-site requests (CSRF). Browsers always send Origin on POST.
 * - rateLimit: slows down card-testing bots and password guessing. In-memory, so it is per
 *   server instance; add a Vercel Firewall rate-limit rule on /api/* for a global limit.
 */

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
}

const buckets = new Map<string, number[]>();

/** True if allowed; records the hit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < 86_400_000)) buckets.delete(k);
  }
  return true;
}

export const NO_STORE = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" };

export function deny(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

/** Common guard for state-changing routes. Returns a response to send, or null to continue. */
export function guard(request: Request, scope: string, limits: Array<[number, number]>): NextResponse | null {
  if (!sameOrigin(request)) return deny("This request was blocked.", 403);
  const ip = clientIp(request);
  for (const [limit, windowMs] of limits) {
    if (!rateLimit(`${scope}:${windowMs}:${ip}`, limit, windowMs)) {
      return deny("Too many attempts. Please wait a few minutes and try again.", 429);
    }
  }
  return null;
}

/** Trim, collapse control characters and cap length of user text. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}
