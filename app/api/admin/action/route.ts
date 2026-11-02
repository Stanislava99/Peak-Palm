import { bookingFromIntent, forgetBookedNights, listBookings } from "@/lib/bookings";
import { notifyConfirmed, notifyDeclined } from "@/lib/booking-notify";
import { guard } from "@/lib/security";
import { isTestSite } from "@/lib/site-config";
import { eachNight } from "@/lib/stay";
import { currentAdmin } from "@/lib/host-auth";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

type Action = "accept" | "decline" | "cash-received" | "cash-undo";

export async function POST(request: Request) {
  const blocked = guard(request, "host-action", [[60, 10 * 60_000]]);
  if (blocked) return blocked;
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not set up." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { id?: string; action?: Action } | null;
  if (!body?.id?.startsWith("pi_") || !body.action) {
    return NextResponse.json({ error: "Unknown booking." }, { status: 400 });
  }

  const intent = await stripe.paymentIntents.retrieve(body.id);
  const booking = bookingFromIntent(intent);
  if (!booking) return NextResponse.json({ error: "That payment isn’t a booking from this site." }, { status: 404 });
  forgetBookedNights(booking.property);

  try {
    if (body.action === "accept") {
      if (booking.status !== "pending") {
        return NextResponse.json({ error: "This booking isn’t waiting for a decision any more." }, { status: 409 });
      }
      const mine = new Set(eachNight(booking.checkIn, booking.checkOut));
      const clash = (await listBookings(booking.property)).find(
        (other) =>
          other.paymentIntentId !== booking.paymentIntentId &&
          other.status === "confirmed" &&
          eachNight(other.checkIn, other.checkOut).some((night) => mine.has(night)),
      );
      if (clash && !isTestSite()) {
        return NextResponse.json(
          { error: `These dates overlap confirmed booking ${clash.ref}. Decline this one.` },
          { status: 409 },
        );
      }
      if (intent.status === "requires_capture") {
        // Older bookings made with a card hold.
        await stripe.paymentIntents.capture(intent.id, {}, { idempotencyKey: `capture-${intent.id}` });
      }
      await stripe.paymentIntents.update(intent.id, {
        metadata: { bookingStatus: "confirmed", confirmedAt: new Date().toISOString() },
      });
      const mailed = await notifyConfirmed(stripe, { ...booking, status: "confirmed" });
      return NextResponse.json({
        ok: true,
        message: mailed
          ? "Confirmed. The guest has received the confirmation and PDF."
          : "Confirmed, but the email couldn’t be sent. Check the email settings, or send the PDF yourself.",
      });
    }

    if (body.action === "decline") {
      if (booking.status !== "pending") {
        return NextResponse.json({ error: "Only bookings waiting for you can be declined here. Refund confirmed ones in Stripe." }, { status: 409 });
      }
      if (intent.status === "requires_capture") {
        await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `cancel-${intent.id}` });
      } else {
        await stripe.refunds.create({ payment_intent: intent.id }, { idempotencyKey: `refund-${intent.id}` });
      }
      await stripe.paymentIntents.update(intent.id, {
        metadata: { bookingStatus: "declined", declinedAt: new Date().toISOString() },
      });
      await notifyDeclined(stripe, { ...booking, status: "declined" });
      return NextResponse.json({ ok: true, message: "Declined. The deposit has been refunded in full and the guest informed." });
    }

    if (body.action === "cash-received" || body.action === "cash-undo") {
      if (booking.status !== "confirmed") {
        return NextResponse.json({ error: "Confirm the booking first." }, { status: 409 });
      }
      if (body.action === "cash-undo") {
        await stripe.paymentIntents.update(intent.id, { metadata: { balanceCash: "" } });
        return NextResponse.json({ ok: true, message: "Balance marked as not received." });
      }
      if (intent.metadata.balanceCash) return NextResponse.json({ ok: true, message: "Already marked as received." });
      await stripe.paymentIntents.update(intent.id, {
        metadata: { balanceCash: `${new Date().toISOString()} ${admin}`.slice(0, 480) },
      });
      return NextResponse.json({ ok: true, message: `Balance of ${booking.balance} € marked as received in cash.` });
    }
  } catch (error) {
    console.error("Host action failed", error);
    return NextResponse.json({ error: "Stripe didn’t accept that. Check the payment in your Stripe dashboard." }, { status: 502 });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
