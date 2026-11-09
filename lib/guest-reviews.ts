import { createHmac, hkdfSync, timingSafeEqual } from "crypto";
import type Stripe from "stripe";
import { bookingFromIntent, type Booking } from "./bookings";
import { listSiteIntents } from "./stripe-records";
import type { PropertyId } from "./properties";
import type { Review } from "./reviews";
import { paymentsEnabled } from "./stripe";
import { dbConfigured } from "./db";

/**
 * Reviews from guests who booked direct.
 * - After check-out each guest gets a personal, signed link (valid 120 days) to /review.
 * - The review is stored in the database (reviews table), with a copy on the deposit payment in Stripe.
 * - Nothing is shown on the site until the host publishes it on /admin.
 */
export type ReviewStatus = "pending" | "published" | "hidden";

export type DirectReview = {
  paymentIntentId: string;
  ref: string;
  property: PropertyId;
  name: string;
  rating: number;
  text: string;
  stayMonth: string;
  submittedAt: string;
  status: ReviewStatus;
};

import { REVIEW_TEXT_MAX } from "./review-limits";

export { REVIEW_TEXT_MAX, REVIEW_TEXT_MIN } from "./review-limits";
const LINK_DAYS = 120;
const PART = 490;

/* ── Signed review links ── */
function key() {
  const material = process.env.REVIEW_LINK_SECRET?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || "";
  return Buffer.from(hkdfSync("sha256", material, "peakandpalm-review", "review-link-v1", 32));
}

function sign(payload: string) {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

export function reviewToken(paymentIntentId: string) {
  const payload = `r.${Math.floor(Date.now() / 1000) + LINK_DAYS * 86_400}.${paymentIntentId}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the payment id the link belongs to, or null if it was altered or has expired. */
export function readReviewToken(token: unknown): string | null {
  if (typeof token !== "string" || token.length > 300) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "r" || !parts[2].startsWith("pi_")) return null;
  const expected = Buffer.from(sign(parts.slice(0, 3).join(".")));
  const given = Buffer.from(parts[3]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(parts[1]) * 1000 < Date.now()) return null;
  return parts[2];
}

/* ── Stored on the payment ── */
export function reviewMetadata(input: { name: string; rating: number; text: string }) {
  const text = input.text.slice(0, REVIEW_TEXT_MAX);
  return {
    reviewStatus: "pending",
    reviewRating: String(input.rating),
    reviewName: input.name.slice(0, 40),
    reviewText1: text.slice(0, PART),
    reviewText2: text.slice(PART, PART * 2),
    reviewText3: text.slice(PART * 2),
    reviewAt: new Date().toISOString(),
  };
}

function stayMonth(checkIn: string) {
  const date = new Date(`${checkIn}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function reviewFromIntent(intent: Stripe.PaymentIntent): DirectReview | null {
  const booking = bookingFromIntent(intent);
  const m = intent.metadata ?? {};
  const status = m.reviewStatus as ReviewStatus | undefined;
  if (!booking || !status || !["pending", "published", "hidden"].includes(status)) return null;
  return {
    paymentIntentId: intent.id,
    ref: booking.ref,
    property: booking.property,
    name: m.reviewName || booking.name.split(" ")[0] || "Guest",
    rating: Math.max(1, Math.min(5, Number(m.reviewRating) || 5)),
    text: `${m.reviewText1 ?? ""}${m.reviewText2 ?? ""}${m.reviewText3 ?? ""}`,
    stayMonth: stayMonth(booking.checkIn),
    submittedAt: m.reviewAt ?? "",
    status,
  };
}

/** Review state of a booking, for the admin page. */
export function reviewStateOf(intent: Stripe.PaymentIntent) {
  return {
    requestedAt: intent.metadata?.reviewRequestedAt || null,
    review: reviewFromIntent(intent),
  };
}

export async function listDirectReviews(options: { status?: ReviewStatus; property?: PropertyId } = {}): Promise<DirectReview[]> {
  if (dbConfigured()) {
    try {
      const { listReviews } = await import("./booking-store");
      const rows = await listReviews(options);
      return rows.map((r) => ({
        paymentIntentId: r.payment_intent ?? "",
        ref: r.ref,
        property: r.property,
        name: r.name,
        rating: r.rating,
        text: r.text,
        stayMonth: stayMonth(r.check_in),
        submittedAt: new Date(r.submitted_at).toISOString(),
        status: r.status,
      }));
    } catch (error) {
      console.warn("Direct reviews unavailable", (error as Error).message);
      return [];
    }
  }
  if (!paymentsEnabled()) return [];
  try {
    const intents = await listSiteIntents("deposit");
    return intents
      .filter((intent) => intent.metadata.reviewStatus)
      .filter((intent) => !options.property || intent.metadata.property === options.property)
      .map(reviewFromIntent)
      .filter((r): r is DirectReview => Boolean(r) && (!options.status || r!.status === options.status))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  } catch (error) {
    console.warn("Direct reviews unavailable", (error as Error).message);
    return [];
  }
}

/** Published direct reviews in the shape the review carousel uses. */
export async function publishedDirectReviews(property: PropertyId): Promise<Review[]> {
  const reviews = await listDirectReviews({ status: "published", property });
  return reviews.map((r) => ({
    id: `direct-${r.paymentIntentId || r.ref}`,
    name: r.name,
    date: r.stayMonth,
    rating: r.rating,
    text: r.text,
    translated: false,
    verified: true,
  }));
}

/** Confirmed stays that ended 1–14 days ago and haven't been asked for a review yet. */
export async function bookingsDueForReview(): Promise<Array<{ booking: Booking; intent: Stripe.PaymentIntent }>> {
  if (!paymentsEnabled()) return [];
  if (dbConfigured()) {
    const { bookingsDueForReview: dueDb } = await import("./booking-store");
    const { findIntent } = await import("./stripe");
    const out: Array<{ booking: Booking; intent: Stripe.PaymentIntent }> = [];
    for (const booking of await dueDb()) {
      const found = booking.paymentIntentId ? await findIntent(booking.paymentIntentId) : null;
      if (found) out.push({ booking, intent: found.intent });
    }
    return out;
  }
  const intents = (await listSiteIntents("deposit")).filter((intent) => intent.metadata.bookingStatus === "confirmed");
  const today = new Date().toISOString().slice(0, 10);
  const earliest = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  return intents
    .filter((intent) => !intent.metadata.reviewRequestedAt && !intent.metadata.reviewStatus)
    .map((intent) => ({ intent, booking: bookingFromIntent(intent) }))
    .filter((x): x is { intent: Stripe.PaymentIntent; booking: Booking } => Boolean(x.booking))
    .filter(({ booking }) => booking.status === "confirmed" && booking.checkOut < today && booking.checkOut >= earliest && Boolean(booking.email));
}
