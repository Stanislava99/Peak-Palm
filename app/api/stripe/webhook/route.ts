import { SITE_TAG, bookingFromIntent, forgetBookedNights, type Booking } from "@/lib/bookings";
import { sendEmail } from "@/lib/email";
import { HOUSE_NAMES, adminEvent, adminNewRequest, guestBalancePaid } from "@/lib/email-templates";
import { confirmationPdf } from "@/lib/pdf/confirmation";
import { notifyEmails } from "@/lib/site-config";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe → site notifications. Every event is verified with STRIPE_WEBHOOK_SECRET.
 * Each email is sent once: a flag is stored on the payment after sending, and Stripe’s retries skip it.
 * Events to enable on the endpoint:
 *   payment_intent.succeeded, payment_intent.payment_failed
 * Deposit paid → hosts are notified. Confirmation/decline emails are sent from the admin page.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) return NextResponse.json({ error: "Webhooks not configured" }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("missing signature");
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    console.warn("Rejected webhook", (error as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!event.type.startsWith("payment_intent.")) return NextResponse.json({ ok: true });
  const intent = event.data.object as Stripe.PaymentIntent;
  if (intent.metadata?.site !== SITE_TAG) return NextResponse.json({ ok: true, ignored: true });

  try {
    await handle(stripe, event.type, intent);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook handling failed; Stripe will retry", (error as Error).message);
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }
}

async function once(stripe: Stripe, intent: Stripe.PaymentIntent, flag: string, send: () => Promise<boolean>) {
  const fresh = await stripe.paymentIntents.retrieve(intent.id);
  if (fresh.metadata?.[flag]) return;
  const ok = await send();
  if (!ok) throw new Error(`email for ${flag} not sent`);
  await stripe.paymentIntents.update(intent.id, { metadata: { [flag]: new Date().toISOString() } });
}

async function mail(to: string[], content: { subject: string; html: string; text: string }, pdf?: { name: string; data: Buffer }, replyTo?: string) {
  const result = await sendEmail({
    to,
    ...content,
    replyTo,
    attachments: pdf ? [{ filename: pdf.name, content: pdf.data, contentType: "application/pdf" }] : undefined,
  });
  // Not configured yet: don't make Stripe retry forever.
  return result.sent || result.error === "email not configured";
}

async function handle(stripe: Stripe, type: string, intent: Stripe.PaymentIntent) {
  const kind = intent.metadata.kind;

  if (kind === "deposit") {
    const booking = bookingFromIntent(intent);
    if (!booking) return;
    forgetBookedNights(booking.property);

    // Deposit paid → tell the hosts. The guest hears from us only when the host confirms.
    const paid = type === "payment_intent.succeeded" || (type === "payment_intent.amount_capturable_updated" && intent.status === "requires_capture");
    if (paid && booking.status === "pending") {
      await once(stripe, intent, "mailedRequest", async () =>
        mail(notifyEmails(), adminNewRequest(booking), undefined, booking.email),
      );
    }
    return;
  }

  if (kind === "balance") {
    const depositId = intent.metadata.depositIntent;
    if (!depositId) return;
    const deposit = await stripe.paymentIntents.retrieve(depositId);
    const base = bookingFromIntent(deposit);
    if (!base) return;
    const booking: Booking = { ...base, balancePaid: type === "payment_intent.succeeded" };

    if (type === "payment_intent.succeeded") {
      if (!deposit.metadata.balancePaymentIntent) {
        await stripe.paymentIntents.update(deposit.id, { metadata: { balancePaymentIntent: intent.id } });
      }
      await once(stripe, intent, "mailedBalance", async () => {
        const pdf = { name: `Peak-and-Palm-${booking.ref}-paid.pdf`, data: await confirmationPdf(booking, "paid") };
        const guest = await mail([booking.email], guestBalancePaid(booking), pdf);
        const admin = await mail(notifyEmails(), adminEvent(booking, "Balance received, fully paid"), pdf);
        return guest && admin;
      });
    }

    if (type === "payment_intent.payment_failed") {
      await once(stripe, intent, "mailedBalanceFailed", async () =>
        mail(notifyEmails(), adminEvent(booking, `Balance payment failed for ${HOUSE_NAMES[booking.property]}: send a payment link`)),
      );
    }
  }
}
