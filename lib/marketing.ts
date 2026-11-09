import { createHmac, hkdfSync, timingSafeEqual } from "crypto";
import { getSiteUrl } from "./site";

/**
 * Offers by email (consent-based marketing).
 * - Guests opt in with an optional, unticked box at checkout; the time is stored on the booking.
 * - Every offer email must carry the guest's unsubscribe link (see unsubscribeUrl). Unsubscribing,
 *   or a host removing the guest on /admin, is stored in marketing_optouts.
 * - Consent counts only for guests who actually paid for a stay.
 * Links don't expire, so an old email can always be used to unsubscribe.
 */
export { OFFERS_LINE as MARKETING_LINE } from "./booking-config";

function key() {
  const material = process.env.UNSUBSCRIBE_SECRET?.trim() || process.env.REVIEW_LINK_SECRET?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || "";
  return Buffer.from(hkdfSync("sha256", material, "seaandski-unsubscribe", "unsubscribe-v1", 32));
}

const b64 = (v: string) => Buffer.from(v).toString("base64url");

function sign(payload: string) {
  return createHmac("sha256", key()).update(payload).digest("base64url").slice(0, 32);
}

export function unsubscribeToken(email: string) {
  const payload = `u.${b64(email.trim().toLowerCase())}`;
  return `${payload}.${sign(payload)}`;
}

/** The email address a link belongs to, or null if the link was altered. */
export function readUnsubscribeToken(token: unknown): string | null {
  if (typeof token !== "string" || token.length > 400) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "u") return null;
  const expected = Buffer.from(sign(parts.slice(0, 2).join(".")));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const email = Buffer.from(parts[1], "base64url").toString();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function unsubscribeUrl(email: string) {
  return `${getSiteUrl()}/unsubscribe?t=${unsubscribeToken(email)}`;
}
