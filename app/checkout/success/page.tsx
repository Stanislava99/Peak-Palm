import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icons";
import { HOST_REPLY } from "@/lib/booking-config";
import { bookingFromIntent, forgetBookedNights } from "@/lib/bookings";
import { brand } from "@/lib/brand";
import { formatMoney } from "@/lib/pricing";
import { formatLong } from "@/lib/stay";
import { getStripe } from "@/lib/stripe";
import type { Metadata } from "next";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Booking received", robots: { index: false, follow: false } };

const NAMES = { kaja: "Villa Kaja", janis: "Jani’s Beach House" } as const;

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams;
  const stripe = getStripe();
  let booking = null;
  if (stripe && sessionId?.startsWith("cs_")) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
      const intent = session.payment_intent as Stripe.PaymentIntent | null;
      booking = intent ? bookingFromIntent(intent) : null;
      if (booking) forgetBookedNights(booking.property);
    } catch {
      booking = null;
    }
  }

  return (
    <div className="checkout-page">
      <Header sections={false} />
      <main className="checkout" id="top">
        {booking ? (
          <div className="success-card">
            <span className="success-icon">
              <Icon name="check" size={34} />
            </span>
            <p className="eyebrow">Reference {booking.ref}</p>
            <h1>Thank you, {booking.name.split(" ")[0]}</h1>
            <p className="success-lede">
              We’ve received your deposit of <b>{formatMoney(booking.deposit)}</b> for {NAMES[booking.property]}. Your dates
              are reserved while {brand.host} confirms your booking, {HOST_REPLY}.
            </p>
            <dl className="summary-stay">
              <div>
                <dt>Check-in</dt>
                <dd>{formatLong(booking.checkIn)}</dd>
              </div>
              <div>
                <dt>Check-out</dt>
                <dd>{formatLong(booking.checkOut)}</dd>
              </div>
              <div>
                <dt>Guests</dt>
                <dd>{booking.guests}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{formatMoney(booking.directTotal)}</dd>
              </div>
            </dl>
            <p className="success-next">
              Your booking confirmation, with a PDF, will be sent to <b>{booking.email}</b>. The remaining{" "}
              {formatMoney(booking.balance)} is charged to the same card before arrival.
            </p>
            <a className="button primary" href="/">
              Back to {brand.short}
            </a>
          </div>
        ) : (
          <div className="success-card">
            <h1>Booking received</h1>
            <p className="success-lede">
              If you completed the payment, your deposit is received and your confirmation will follow by email.
            </p>
            <a className="button primary" href="/">
              Back to {brand.short}
            </a>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
