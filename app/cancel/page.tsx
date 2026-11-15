import { Header } from "@/components/Header";
import { CancelButton } from "@/components/CancelBooking";
import { CANCEL_HOURS, CANCELLATION_INTRO, CANCELLATION_POLICY } from "@/lib/booking-config";
import { guestCancellationRefund } from "@/lib/stripe-fee";
import { brand } from "@/lib/brand";
import { canStillCancel, cancelDeadline, formatDeadline, readCancelToken } from "@/lib/cancellation";
import { bookingForIntent } from "@/lib/guest-booking";
import { formatMoney } from "@/lib/pricing";
import { contactEmail } from "@/lib/site-config";
import { formatLong } from "@/lib/stay";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cancel your booking", robots: { index: false, follow: false } };

const NAMES = { kaja: "Villa Kaja", janis: "Jani’s Beach House" } as const;

function Policy() {
  return (
    <div className="cancel-policy">
      <p>{CANCELLATION_INTRO}</p>
      <ul>
        {CANCELLATION_POLICY.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function Contact({ refId }: { refId?: string }) {
  const email = contactEmail();
  const subject = encodeURIComponent(refId ? `Booking ${refId}` : "My booking");
  return (
    <p className="cancel-contact">
      Questions, or a change of dates? Write to {brand.host} at{" "}
      <a href={`mailto:${email}?subject=${subject}`}>{email}</a>, or simply reply to your booking email.
    </p>
  );
}

export default async function CancelPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const intentId = readCancelToken(t);
  const found = intentId ? await bookingForIntent(intentId).catch(() => null) : null;
  const booking = found?.booking ?? null;

  let body: React.ReactNode;
  if (!booking || !t) {
    body = (
      <>
        <h1>Cancel your booking</h1>
        <p className="success-lede">This link isn’t complete. Please use the button in your booking email, or contact us.</p>
        <Policy />
        <Contact />
      </>
    );
  } else if (booking.status === "cancelled") {
    const refundedAmount = Number(found!.intent.metadata?.refundedAmount) || (await guestCancellationRefund(found!.stripe, found!.intent, booking.deposit)).refund;
    body = (
      <>
        <p className="eyebrow">Reference {booking.ref}</p>
        <h1>Already cancelled</h1>
        <p className="success-lede">
          Your stay at {NAMES[booking.property]} is cancelled. We’ve refunded <b>{formatMoney(refundedAmount)}</b> to your
          card (your deposit minus the card payment fee charged by Stripe). It usually shows within 5 to 10 working days.
        </p>
        <Contact refId={booking.ref} />
      </>
    );
  } else if (booking.status === "declined") {
    body = (
      <>
        <p className="eyebrow">Reference {booking.ref}</p>
        <h1>Nothing to cancel</h1>
        <p className="success-lede">This booking couldn’t be confirmed, and your deposit has already been refunded in full.</p>
        <Contact refId={booking.ref} />
      </>
    );
  } else if (canStillCancel(booking)) {
    const until = formatDeadline(cancelDeadline(booking));
    const { fee, refund } = await guestCancellationRefund(found!.stripe, found!.intent, booking.deposit);
    body = (
      <>
        <p className="eyebrow">Reference {booking.ref}</p>
        <h1>Cancel your booking?</h1>
        <p className="success-lede">
          You can cancel until <b>{until}</b>.
        </p>
        <dl className="cancel-refund">
          <div>
            <dt>Deposit paid</dt>
            <dd>{formatMoney(booking.deposit)}</dd>
          </div>
          <div>
            <dt>Card payment fee charged by Stripe on your payment</dt>
            <dd>−{formatMoney(fee)}</dd>
          </div>
          <div className="is-total">
            <dt>Refunded to your card</dt>
            <dd>{formatMoney(refund)}</dd>
          </div>
        </dl>
        <dl className="summary-stay">
          <div>
            <dt>House</dt>
            <dd>{NAMES[booking.property]}</dd>
          </div>
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
        </dl>
        <CancelButton token={t} refund={formatMoney(refund)} />
        <Policy />
        <Contact refId={booking.ref} />
      </>
    );
  } else {
    body = (
      <>
        <p className="eyebrow">Reference {booking.ref}</p>
        <h1>Free cancellation has ended</h1>
        <p className="success-lede">
          Bookings can be cancelled with a full refund within {CANCEL_HOURS} hours of booking. For this stay that period ended on{" "}
          <b>{formatDeadline(cancelDeadline(booking))}</b>, so the booking can no longer be cancelled online and the deposit is non-refundable.
        </p>
        <Policy />
        <Contact refId={booking.ref} />
      </>
    );
  }

  return (
    <div className="checkout-page">
      <Header sections={false} />
      <main className="checkout host" id="top">
        <div className="success-card cancel-card">
          <p className="eyebrow">Sea &amp; Ski Villas</p>
          {body}
        </div>
      </main>
    </div>
  );
}
