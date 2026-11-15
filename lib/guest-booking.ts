import { bookingFromIntent, type Booking } from "./bookings";
import { dbConfigured } from "./db";
import { findIntent } from "./stripe";

/** The booking a signed guest link points at: from the database when there is one, else from the Stripe payment. */
export async function bookingForIntent(intentId: string) {
  const found = await findIntent(intentId);
  if (!found) return null;
  let booking: Booking | null = bookingFromIntent(found.intent);
  if (booking && dbConfigured()) {
    const { getBookingByIntent, importIntent } = await import("./booking-store");
    const stored = (await getBookingByIntent(intentId)) ?? ((await importIntent(found.intent)) ? await getBookingByIntent(intentId) : null);
    if (stored) booking = stored;
  }
  return booking ? { ...found, booking } : null;
}
