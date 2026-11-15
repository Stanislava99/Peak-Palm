import { createHmac, hkdfSync, timingSafeEqual } from "crypto";
import { CANCEL_HOURS } from "./booking-config";
import type { Booking } from "./bookings";
import { getSiteUrl } from "./site";

/**
 * Guest cancellation links (policy: deposit refunded, minus Stripe's card fee, within 48 hours of booking).
 * - The "Deposit received" email (and the confirmation, while still in time) carries a personal, signed link to /cancel.
 * - The window runs from the moment the deposit was paid, which is when that email is sent.
 * - After the deadline the link still opens, but only explains the policy and how to contact the host.
 * - Cancelling needs a button press on the page, so mail apps that open links can't cancel anything.
 */
const WINDOW_MS = CANCEL_HOURS * 3_600_000;
/** Links stay readable (to show the "too late" page) for a year. */
const LINK_DAYS = 365;

function key() {
  const material =
    process.env.CANCEL_LINK_SECRET?.trim() || process.env.REVIEW_LINK_SECRET?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || "";
  return Buffer.from(hkdfSync("sha256", material, "seaandski-cancel", "cancel-link-v1", 32));
}

function sign(payload: string) {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

/** When the free-cancellation window closes for this booking. */
export function cancelDeadline(b: Pick<Booking, "createdAt">): Date {
  return new Date(new Date(b.createdAt).getTime() + WINDOW_MS);
}

export function canStillCancel(b: Pick<Booking, "createdAt" | "status">, now = Date.now()) {
  return (b.status === "pending" || b.status === "confirmed") && now < cancelDeadline(b).getTime();
}

export function cancelToken(paymentIntentId: string) {
  const payload = `c.${Math.floor(Date.now() / 1000) + LINK_DAYS * 86_400}.${paymentIntentId}`;
  return `${payload}.${sign(payload)}`;
}

/** The payment id the link belongs to, or null if it was altered (or is over a year old). */
export function readCancelToken(token: unknown): string | null {
  if (typeof token !== "string" || token.length > 300) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "c" || !parts[2].startsWith("pi_")) return null;
  const expected = Buffer.from(sign(parts.slice(0, 3).join(".")));
  const given = Buffer.from(parts[3]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(parts[1]) * 1000 < Date.now()) return null;
  return parts[2];
}

export function cancelUrl(b: Pick<Booking, "paymentIntentId">) {
  return `${getSiteUrl()}/cancel?t=${encodeURIComponent(cancelToken(b.paymentIntentId))}`;
}

/** "Thursday 12 November, 15:42 (Bulgaria & Greece time)". Both houses are on the same clock. */
export function formatDeadline(date: Date) {
  const text = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Athens",
  }).format(date);
  return `${text.replace(" at ", ", ")} (Bulgaria & Greece time)`;
}
