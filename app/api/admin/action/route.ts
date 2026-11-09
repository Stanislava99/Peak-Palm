import { bookingFromIntent, forgetBookedNights, listBookings } from "@/lib/bookings";
import { notifyConfirmed, notifyDeclined, notifyDepositPaid } from "@/lib/booking-notify";
import { guard } from "@/lib/security";
import { isTestSite } from "@/lib/site-config";
import { eachNight } from "@/lib/stay";
import { currentAdmin } from "@/lib/host-auth";
import { findIntent, paymentsEnabled } from "@/lib/stripe";
import { reviewFromIntent } from "@/lib/guest-reviews";
import { sendReviewRequest } from "@/lib/review-requests";
import { revalidatePath } from "next/cache";
import { dbConfigured } from "@/lib/db";
import {
  claimDecision, getBookingByIntent, hasReview, importIntent, logEvent, moderateReview, setCash, setStatus, undoDecision,
} from "@/lib/booking-store";
import { NextResponse } from "next/server";

type Action = "accept" | "decline" | "cash-received" | "cash-undo" | "review-request" | "review-publish" | "review-hide" | "resend-emails";

export async function POST(request: Request) {
  const blocked = await guard(request, "host-action", [[60, 10 * 60_000]]);
  if (blocked) return blocked;
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  if (!paymentsEnabled()) return NextResponse.json({ error: "Stripe is not set up." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { id?: string; action?: Action } | null;
  if (!body?.id?.startsWith("pi_") || !body.action) {
    return NextResponse.json({ error: "Unknown booking." }, { status: 400 });
  }

  const found = await findIntent(body.id);
  if (!found) return NextResponse.json({ error: "Unknown booking." }, { status: 404 });
  const { stripe, intent } = found;
  const useDb = dbConfigured();
  let booking = bookingFromIntent(intent);
  if (useDb && booking) {
    // The database is the record; bookings made before it existed are copied in on first use.
    const stored = (await getBookingByIntent(intent.id)) ?? ((await importIntent(intent)) ? await getBookingByIntent(intent.id) : null);
    if (stored) booking = stored;
  }
  if (!booking) return NextResponse.json({ error: "That payment isn’t a booking from this site." }, { status: 404 });
  forgetBookedNights(booking.property);

  try {
    if (body.action === "accept") {
      if (booking.status === "confirmed") return NextResponse.json({ ok: true, message: "Already confirmed." });
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
      // Two admins clicking at the same moment: only one decision goes through.
      if (useDb && !(await claimDecision(booking.ref, "confirmed"))) {
        const now = await getBookingByIntent(intent.id);
        if (now?.status === "confirmed") return NextResponse.json({ ok: true, message: "Already confirmed." });
        return NextResponse.json({ error: "This booking was just handled by someone else. Reload the page." }, { status: 409 });
      }
      try {
        if (intent.status === "requires_capture") {
          // Older bookings made with a card hold.
          await stripe.paymentIntents.capture(intent.id, {}, { idempotencyKey: `capture-${intent.id}` });
        }
        await stripe.paymentIntents.update(intent.id, {
          metadata: { bookingStatus: "confirmed", confirmedAt: new Date().toISOString() },
        });
      } catch (error) {
        if (useDb) await undoDecision(booking.ref);
        throw error;
      }
      if (useDb) await setStatus(booking.ref, "confirmed", admin);
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
      if (useDb && !(await claimDecision(booking.ref, "declined"))) {
        return NextResponse.json({ error: "This booking was just handled by someone else. Reload the page." }, { status: 409 });
      }
      let refundId: string | undefined;
      try {
        if (intent.status === "requires_capture") {
          await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `cancel-${intent.id}` });
        } else {
          const refund = await stripe.refunds.create({ payment_intent: intent.id }, { idempotencyKey: `refund-${intent.id}` });
          refundId = refund.id;
        }
        await stripe.paymentIntents.update(intent.id, {
          metadata: { bookingStatus: "declined", declinedAt: new Date().toISOString() },
        });
      } catch (error) {
        if (useDb) await undoDecision(booking.ref);
        throw error;
      }
      if (useDb) await setStatus(booking.ref, "declined", admin, { refundId });
      await notifyDeclined(stripe, { ...booking, status: "declined" });
      return NextResponse.json({ ok: true, message: "Declined. The deposit has been refunded in full and the guest informed." });
    }

    if (body.action === "resend-emails") {
      if (useDb) await logEvent(booking.ref, admin, "emails_resent");
      if (booking.status === "pending") {
        const ok = await notifyDepositPaid(stripe, booking, { force: true });
        return ok
          ? NextResponse.json({ ok: true, message: "Sent again: “New booking” to the hosts and “Deposit received” to the guest." })
          : NextResponse.json({ error: "The emails couldn’t be sent. Check the email settings (SMTP or Resend)." }, { status: 502 });
      }
      if (booking.status === "confirmed") {
        const ok = await notifyConfirmed(stripe, booking, { force: true });
        return ok
          ? NextResponse.json({ ok: true, message: "Confirmation and PDF sent again." })
          : NextResponse.json({ error: "The email couldn’t be sent. Check the email settings (SMTP or Resend)." }, { status: 502 });
      }
      return NextResponse.json({ error: "Nothing to resend for this booking." }, { status: 409 });
    }

    if (body.action === "review-request") {
      if (booking.status !== "confirmed") return NextResponse.json({ error: "Only confirmed stays can be reviewed." }, { status: 409 });
      if (useDb ? await hasReview(booking.ref) : reviewFromIntent(intent)) return NextResponse.json({ error: "This guest has already left a review." }, { status: 409 });
      const result = await sendReviewRequest(stripe, intent, booking);
      return result.sent
        ? NextResponse.json({ ok: true, message: `Review request sent to ${booking.email}.` })
        : NextResponse.json({ error: `The email couldn’t be sent (${result.error}).` }, { status: 502 });
    }

    if (body.action === "review-publish" || body.action === "review-hide") {
      const status = body.action === "review-publish" ? "published" : "hidden";
      if (useDb) {
        if (!(await moderateReview(booking.ref, status, admin))) {
          return NextResponse.json({ error: "There’s no review on this booking." }, { status: 404 });
        }
      } else if (!reviewFromIntent(intent)) {
        return NextResponse.json({ error: "There’s no review on this booking." }, { status: 404 });
      }
      await stripe.paymentIntents.update(intent.id, { metadata: { reviewStatus: status, reviewModeratedAt: new Date().toISOString() } });
      revalidatePath(booking.property === "kaja" ? "/villa-kaja" : "/janis");
      return NextResponse.json({
        ok: true,
        message: status === "published" ? "Published. It appears on the house page within a few minutes (at most 30)." : "Hidden from the website.",
      });
    }

    if (body.action === "cash-received" || body.action === "cash-undo") {
      if (booking.status !== "confirmed") {
        return NextResponse.json({ error: "Confirm the booking first." }, { status: 409 });
      }
      if (body.action === "cash-undo") {
        await stripe.paymentIntents.update(intent.id, { metadata: { balanceCash: "" } });
        if (useDb) await setCash(booking.ref, null);
        return NextResponse.json({ ok: true, message: "Balance marked as not received." });
      }
      if (useDb ? booking.balancePaid : intent.metadata.balanceCash) return NextResponse.json({ ok: true, message: "Already marked as received." });
      await stripe.paymentIntents.update(intent.id, {
        metadata: { balanceCash: `${new Date().toISOString()} ${admin}`.slice(0, 480) },
      });
      if (useDb) await setCash(booking.ref, admin);
      return NextResponse.json({ ok: true, message: `Balance of ${booking.balance} € marked as received in cash.` });
    }
  } catch (error) {
    console.error("Host action failed", error);
    return NextResponse.json({ error: "Stripe didn’t accept that. Check the payment in your Stripe dashboard." }, { status: 502 });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
