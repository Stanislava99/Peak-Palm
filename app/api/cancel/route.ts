import { forgetBookedNights } from "@/lib/bookings";
import { notifyCancelled } from "@/lib/booking-notify";
import { guestCancellationRefund } from "@/lib/stripe-fee";
import { canStillCancel, readCancelToken } from "@/lib/cancellation";
import { dbConfigured } from "@/lib/db";
import { bookingForIntent } from "@/lib/guest-booking";
import { NO_STORE, guard } from "@/lib/security";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * A guest cancels with the signed link from their email, within 48 hours of booking.
 * The deposit is refunded minus the fee Stripe actually charged on it, so the cancellation costs the hosts nothing.
 * (Same refund key as "Decline", so a booking can never be refunded twice.)
 */
export async function POST(request: Request) {
  const blocked = await guard(request, "cancel", [[10, 10 * 60_000]]);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => null)) as { t?: string } | null;
  const intentId = readCancelToken(body?.t);
  if (!intentId) return NextResponse.json({ error: "This cancellation link isn’t valid. Please reply to your booking email instead." }, { status: 400, headers: NO_STORE });

  const found = await bookingForIntent(intentId);
  if (!found) return NextResponse.json({ error: "We couldn’t find this booking. Please reply to your booking email instead." }, { status: 404, headers: NO_STORE });
  const { stripe, intent, booking } = found;

  if (booking.status === "cancelled") return NextResponse.json({ ok: true, already: true }, { headers: NO_STORE });
  if (!canStillCancel(booking)) {
    return NextResponse.json({ error: "The free cancellation period for this booking has ended.", expired: true }, { status: 409, headers: NO_STORE });
  }

  const useDb = dbConfigured();
  let before: string | null = booking.status;
  if (useDb) {
    const { claimCancel } = await import("@/lib/booking-store");
    before = await claimCancel(booking.ref);
    if (!before) {
      // Another click (or tab) got there first.
      const { getBookingByRef } = await import("@/lib/booking-store");
      const now = await getBookingByRef(booking.ref);
      if (now?.status === "cancelled") return NextResponse.json({ ok: true, already: true }, { headers: NO_STORE });
      return NextResponse.json({ error: "This booking can’t be cancelled online any more. Please reply to your booking email." }, { status: 409, headers: NO_STORE });
    }
  }

  let refundId: string | undefined;
  let refunded = 0;
  try {
    if (intent.status === "requires_capture") {
      await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `cancel-${intent.id}` });
    } else if (intent.status === "succeeded") {
      // Never more than what was actually received for this payment.
      const paid = intent.amount_received || intent.amount;
      const { refund: due } = await guestCancellationRefund(stripe, intent, booking.deposit);
      const amount = Math.min(Math.round(due * 100), paid);
      refunded = amount / 100;
      const refund = await stripe.refunds.create(
        { payment_intent: intent.id, amount, metadata: { reason: "guest_cancelled_within_48h" } },
        { idempotencyKey: `refund-${intent.id}` },
      );
      refundId = refund.id;
    }
    await stripe.paymentIntents.update(intent.id, {
      metadata: { bookingStatus: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: "guest", refundedAmount: (refundId ? refunded : 0).toFixed(2) },
    });
  } catch (error) {
    if (useDb && before) {
      const { undoCancel } = await import("@/lib/booking-store");
      await undoCancel(booking.ref, before);
    }
    console.error("Guest cancellation failed", { ref: booking.ref, error: (error as Error).message });
    return NextResponse.json({ error: "The cancellation didn’t go through. Please try again in a minute, or reply to your booking email." }, { status: 502, headers: NO_STORE });
  }

  if (useDb) {
    const { setCancelled } = await import("@/lib/booking-store");
    await setCancelled(booking.ref, refundId);
  }
  forgetBookedNights(booking.property);
  revalidatePath(booking.property === "kaja" ? "/villa-kaja" : "/janis");
  await notifyCancelled(stripe, { ...booking, status: "cancelled" }, refundId ? refunded : undefined).catch(() => false);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
