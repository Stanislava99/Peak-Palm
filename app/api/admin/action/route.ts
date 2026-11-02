import { SITE_TAG, bookingFromIntent, forgetBookedNights, listBookings } from "@/lib/bookings";
import { notifyConfirmed, notifyDeclined } from "@/lib/booking-notify";
import { guard } from "@/lib/security";
import { isTestSite } from "@/lib/site-config";
import { eachNight } from "@/lib/stay";
import { isHost } from "@/lib/host-auth";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import Stripe from "stripe";

type Action = "accept" | "decline" | "charge-balance" | "balance-link";

const NAMES = { kaja: "Villa Kaja", janis: "Jani’s Beach House" } as const;

export async function POST(request: Request) {
  const blocked = guard(request, "host-action", [[60, 10 * 60_000]]);
  if (blocked) return blocked;
  if (!(await isHost())) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
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

    if (booking.status !== "confirmed") {
      return NextResponse.json({ error: "Confirm the booking before charging the balance." }, { status: 409 });
    }
    const paidBefore = await stripe.paymentIntents.search({
      query: `metadata['site']:'${SITE_TAG}' AND metadata['kind']:'balance' AND metadata['depositIntent']:'${intent.id}' AND status:'succeeded'`,
      limit: 1,
    });
    if (intent.metadata.balancePaymentIntent || paidBefore.data.length) {
      return NextResponse.json({ error: "The balance is already paid." }, { status: 409 });
    }
    const customer = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
    const paymentMethod = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
    const description = `${booking.ref} · ${NAMES[booking.property]} · balance`;
    const metadata = { site: SITE_TAG, kind: "balance", ref: booking.ref, depositIntent: intent.id, property: booking.property };

    if (body.action === "charge-balance") {
      if (!customer || !paymentMethod) {
        return NextResponse.json({ error: "No saved card for this guest. Send a payment link instead." }, { status: 409 });
      }
      const balance = await stripe.paymentIntents.create({
        amount: Math.round(booking.balance * 100),
        currency: "eur",
        customer,
        payment_method: paymentMethod,
        off_session: true,
        confirm: true,
        description,
        receipt_email: booking.email || undefined,
        metadata,
      }, { idempotencyKey: `balance-${intent.id}` });
      await stripe.paymentIntents.update(intent.id, { metadata: { balancePaymentIntent: balance.id } });
      return NextResponse.json({ ok: true, message: `Balance of ${booking.balance} € charged.` });
    }

    if (body.action === "balance-link") {
      const origin = request.headers.get("origin") ?? new URL(request.url).origin;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customer ?? undefined,
        customer_email: customer ? undefined : booking.email,
        locale: "en",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: Math.round(booking.balance * 100),
              product_data: { name: `${NAMES[booking.property]} · balance`, description: `${booking.ref} · ${booking.checkIn} → ${booking.checkOut}` },
            },
          },
        ],
        payment_intent_data: { description, metadata },
        payment_method_options: { card: { request_three_d_secure: "any" } },
        expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
        success_url: `${origin}/?balance=paid`,
        cancel_url: `${origin}/`,
      });
      return NextResponse.json({ ok: true, url: session.url, message: "Payment link created. Copy it and send it to the guest." });
    }
  } catch (error) {
    if (error instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json(
        { error: `The card was declined (${error.code ?? "card error"}). Send the guest a payment link instead.` },
        { status: 402 },
      );
    }
    console.error("Host action failed", error);
    return NextResponse.json({ error: "Stripe didn’t accept that. Check the payment in your Stripe dashboard." }, { status: 502 });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
