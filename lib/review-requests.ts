import type Stripe from "stripe";
import type { Booking } from "./bookings";
import { sendEmail } from "./email";
import { guestReviewRequest } from "./email-templates";
import { reviewToken } from "./guest-reviews";
import { getSiteUrl } from "./site";
import { dbConfigured } from "./db";

export function reviewLink(paymentIntentId: string) {
  return `${getSiteUrl()}/review?t=${encodeURIComponent(reviewToken(paymentIntentId))}`;
}

/** Emails the guest their personal review link and records it on the payment (sent once). */
export async function sendReviewRequest(stripe: Stripe, intent: Stripe.PaymentIntent, booking: Booking) {
  const result = await sendEmail({ to: [booking.email], ...guestReviewRequest(booking, reviewLink(intent.id)) });
  if (!result.sent) return { sent: false, error: result.error };
  await stripe.paymentIntents.update(intent.id, { metadata: { reviewRequestedAt: new Date().toISOString() } });
  if (dbConfigured()) {
    const { setReviewRequested } = await import("./booking-store");
    await setReviewRequested(booking.ref);
  }
  return { sent: true };
}
