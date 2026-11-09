import { SITE_TAG, bookingFromIntent, forgetBookedNights, type Booking } from "@/lib/bookings";
import { sendEmail } from "@/lib/email";
import { notifyDepositPaid } from "@/lib/booking-notify";
import { sendOnce } from "@/lib/send-once";
import { HOUSE_NAMES, adminEvent, guestBalancePaid } from "@/lib/email-templates";
import { confirmationPdf } from "@/lib/pdf/confirmation";
import { notifyEmails } from "@/lib/site-config";
import { findIntent, webhookSecrets } from "@/lib/stripe";
import { dbConfigured } from "@/lib/db";
import { markPaid, logEvent } from "@/lib/booking-store";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe → site notifications, from each house’s Stripe account (one endpoint for all).
 * Every event is verified with that account’s signing secret: STRIPE_WEBHOOK_SECRET_KAJA,
 * STRIPE_WEBHOOK_SECRET_JANIS, or STRIPE_WEBHOOK_SECRET when both houses share one account.
 * Each email is sent once: a flag is stored on the payment after sending, and Stripe’s retries skip it.
 * Events to enable on the endpoint:
 *   payment_intent.succeeded, payment_intent.payment_failed
 * Deposit paid → hosts are notified, and the guest gets "deposit received, awaiting confirmation".
 * Confirmation/decline emails are sent from the admin page.
 */
export async function POST(request: Request) {
  const secrets = webhookSecrets().filter((s) => s.stripe);
  if (!secrets.length) return NextResponse.json({ error: "Webhooks not configured" }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  // Verify the signature ourselves (works for Snapshot and Thin payloads alike; the SDK's
  // constructEvent refuses Thin ones), then parse the JSON.
  let event: Stripe.Event | null = null;
  for (const { secret, stripe: verifier } of secrets) {
    try {
      if (!signature) break;
      verifier!.webhooks.signature!.verifyHeader(body, signature, secret, 300);
      event = JSON.parse(body) as Stripe.Event;
      break;
    } catch {
      // not this account's secret; try the next one
    }
  }
  if (!event) {
    console.warn("Rejected webhook: signature matches none of the configured signing secrets");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Accept both payload formats Stripe offers for an event destination:
  //  - Snapshot: { type: "payment_intent.succeeded", data: { object: <PaymentIntent> } }
  //  - Thin:     { type: "v1.payment_intent.succeeded", related_object: { id, type: "payment_intent" } }
  const raw = event as unknown as {
    type: string;
    data?: { object?: { id?: string; object?: string } };
    related_object?: { id?: string; type?: string };
  };
  const type = raw.type.replace(/^v1\./, "");
  if (!type.startsWith("payment_intent.")) {
    console.info("Webhook event ignored (not a payment event):", raw.type);
    return NextResponse.json({ ok: true, ignored: raw.type });
  }
  const id = raw.data?.object?.id ?? (raw.related_object?.type === "payment_intent" ? raw.related_object.id : undefined);
  if (!id) {
    console.warn("Webhook payment event without a payment id:", raw.type);
    return NextResponse.json({ ok: true, ignored: "no payment id" });
  }

  try {
    // Always read the payment fresh from the account that holds it (works for both formats).
    const found = await findIntent(id);
    if (!found) return NextResponse.json({ ok: true, ignored: "payment not in any configured account" });
    const intent = found.intent;
    if (intent.metadata?.site !== SITE_TAG) return NextResponse.json({ ok: true, ignored: true });
    await handle(found.stripe, type, intent);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook handling failed; Stripe will retry", (error as Error).message);
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }
}

async function once(stripe: Stripe, intent: Stripe.PaymentIntent, flag: string, send: () => Promise<boolean>) {
  const ok = await sendOnce(stripe, intent.id, flag, send);
  if (!ok) throw new Error(`email for ${flag} not sent`);
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

    // Deposit paid → tell the hosts, and tell the guest the money is received and what happens next.
    const paid = type === "payment_intent.succeeded" || (type === "payment_intent.amount_capturable_updated" && intent.status === "requires_capture");
    if (paid && booking.status === "pending" && dbConfigured()) await markPaid(intent);
    if (type === "payment_intent.payment_failed" && dbConfigured()) {
      await logEvent(booking.ref, "stripe", "payment_failed", { reason: intent.last_payment_error?.message ?? null });
    }
    if (paid && booking.status === "pending") {
      const ok = await notifyDepositPaid(stripe, booking);
      if (!ok) throw new Error("deposit emails not sent");
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
        const pdf = { name: `Sea-and-Ski-${booking.ref}-paid.pdf`, data: await confirmationPdf(booking, "paid") };
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
