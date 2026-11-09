import type Stripe from "stripe";
import { HOLD_DAYS } from "./booking-config";
import { isPropertyId, type PropertyId } from "./properties";
import { eachNight } from "./stay";
import { isTestSite } from "./site-config";
import { paymentsEnabled } from "./stripe";

/**
 * Bookings live in the database (Neon Postgres, see db.ts) when DATABASE_URL is set.
 * Each deposit PaymentIntent in Stripe also carries the stay in its metadata: that is the backup,
 * and the fallback when no database is connected.
 */
import { dbConfigured } from "./db";
export { SITE_TAG } from "./stripe-records";
import { SITE_TAG, listSiteIntents } from "./stripe-records";

export type BookingStatus = "pending" | "confirmed" | "declined" | "expired" | "unpaid";

export type Booking = {
  ref: string;
  paymentIntentId: string;
  property: PropertyId;
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  phone: string;
  arrival: string;
  note: string;
  airbnbTotal: number | null;
  directTotal: number;
  deposit: number;
  balance: number;
  balancePaid: boolean;
  status: BookingStatus;
  createdAt: string;
  holdExpiresAt: string;
  reviewRequestedAt?: string;
  reviewStatus?: string;
  /** When each email went out (flags stored on the payment), for /admin. */
  emails: { hosts?: string; guest?: string; confirmed?: string; declined?: string };
  /** From the database only. */
  stripeHouse?: PropertyId;
  rawStatus?: string;
  confirmedBy?: string;
  balanceCashBy?: string;
  /** When the guest ticked "send me offers" at checkout (database only). */
  marketingOptInAt?: string;
};

export type BookingMetadata = Record<string, string>;

export function bookingMetadata(input: Omit<Booking, "paymentIntentId" | "status" | "createdAt" | "holdExpiresAt" | "balancePaid" | "reviewRequestedAt" | "reviewStatus" | "emails">): BookingMetadata {
  return {
    site: SITE_TAG,
    kind: "deposit",
    ref: input.ref,
    property: input.property,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: String(input.guests),
    name: input.name.slice(0, 200),
    email: input.email.slice(0, 200),
    phone: input.phone.slice(0, 60),
    arrival: input.arrival.slice(0, 60),
    note: input.note.slice(0, 480),
    airbnbTotal: input.airbnbTotal === null ? "" : String(input.airbnbTotal),
    directTotal: String(input.directTotal),
    deposit: String(input.deposit),
    balance: String(input.balance),
  };
}

function statusOf(intent: Stripe.PaymentIntent): BookingStatus {
  // Deposit is paid up front; the host’s decision is stored on the payment.
  if (intent.status === "succeeded") {
    if (intent.metadata?.bookingStatus === "confirmed") return "confirmed";
    if (intent.metadata?.bookingStatus === "declined") return "declined";
    return "pending";
  }
  if (intent.status === "requires_capture") return "pending";
  if (intent.status === "canceled") {
    return intent.cancellation_reason === "automatic" || intent.cancellation_reason === "abandoned" ? "expired" : "declined";
  }
  return "unpaid";
}

export function bookingFromIntent(intent: Stripe.PaymentIntent): Booking | null {
  const m = intent.metadata ?? {};
  if (m.site !== SITE_TAG || m.kind !== "deposit" || !isPropertyId(m.property)) return null;
  const created = new Date(intent.created * 1000);
  const expires = new Date(created.getTime() + HOLD_DAYS * 86_400_000);
  return {
    ref: m.ref ?? intent.id,
    paymentIntentId: intent.id,
    property: m.property,
    checkIn: m.checkIn ?? "",
    checkOut: m.checkOut ?? "",
    guests: Number(m.guests) || 0,
    name: m.name ?? "",
    email: m.email ?? "",
    phone: m.phone ?? "",
    arrival: m.arrival ?? "",
    note: m.note ?? "",
    airbnbTotal: m.airbnbTotal ? Number(m.airbnbTotal) : null,
    directTotal: Number(m.directTotal) || 0,
    deposit: Number(m.deposit) || intent.amount / 100,
    balance: Number(m.balance) || 0,
    balancePaid: Boolean(m.balancePaymentIntent || m.balanceCash),
    status: statusOf(intent),
    createdAt: created.toISOString(),
    holdExpiresAt: expires.toISOString(),
    reviewRequestedAt: m.reviewRequestedAt || undefined,
    reviewStatus: m.reviewStatus || undefined,
    emails: {
      hosts: m.mailedRequest || undefined,
      guest: m.mailedGuestPending || undefined,
      confirmed: m.mailedConfirmed || undefined,
      declined: m.mailedDeclined || undefined,
    },
  };
}

/** Bookings (deposit payments), newest first. Includes unpaid/expired ones for the history list. */
export async function listBookings(property?: PropertyId): Promise<Booking[]> {
  if (dbConfigured()) {
    const { listBookingsDb } = await import("./booking-store");
    return listBookingsDb(property);
  }
  return listBookingsFromStripe(property);
}

export async function listBookingsFromStripe(property?: PropertyId): Promise<Booking[]> {
  const intents = await listSiteIntents("deposit");
  return intents
    .filter((intent) => intent.status !== "requires_payment_method" || intent.metadata.bookingStatus)
    .filter((intent) => !property || intent.metadata.property === property)
    .map(bookingFromIntent)
    .filter((b): b is Booking => Boolean(b))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const cache = new Map<PropertyId, { at: number; nights: Set<string> }>();

/** Nights taken by card holds or confirmed direct bookings. Cached for a minute. */
export async function directBookedNights(property: PropertyId): Promise<Set<string>> {
  // On the test site, test bookings never block dates, so the same dates can be booked again and again.
  if (!paymentsEnabled(property) || isTestSite()) return new Set();
  const hit = cache.get(property);
  if (hit && Date.now() - hit.at < 60_000) return hit.nights;
  try {
    if (dbConfigured()) {
      // Live from the database (no cache): paid bookings plus guests who are paying right now.
      const { blockedNightsDb } = await import("./booking-store");
      return await blockedNightsDb(property);
    }
    const bookings = await listBookings(property);
    const nights = new Set<string>();
    for (const booking of bookings) {
      if (booking.status !== "pending" && booking.status !== "confirmed") continue;
      for (const night of eachNight(booking.checkIn, booking.checkOut)) nights.add(night);
    }
    cache.set(property, { at: Date.now(), nights });
    return nights;
  } catch {
    return hit?.nights ?? new Set();
  }
}

export function forgetBookedNights(property: PropertyId) {
  cache.delete(property);
}

export function newRef(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;
}
