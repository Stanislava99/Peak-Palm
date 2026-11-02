import type Stripe from "stripe";
import type { Booking } from "./bookings";
import { sendEmail } from "./email";
import { adminEvent, guestConfirmed, guestDeclinedRefunded } from "./email-templates";
import { confirmationPdf } from "./pdf/confirmation";
import { notifyEmails } from "./site-config";

/** Sends a guest/admin email pair once per payment, remembered on the payment itself. */
async function once(stripe: Stripe, intentId: string, flag: string, send: () => Promise<boolean>) {
  const fresh = await stripe.paymentIntents.retrieve(intentId);
  if (fresh.metadata?.[flag]) return true;
  const ok = await send();
  if (ok) await stripe.paymentIntents.update(intentId, { metadata: { [flag]: new Date().toISOString() } });
  return ok;
}

/** The guest’s first email: booking confirmed, with the branded PDF. */
export async function notifyConfirmed(stripe: Stripe, booking: Booking) {
  return once(stripe, booking.paymentIntentId, "mailedConfirmed", async () => {
    const pdf = await confirmationPdf(booking, "deposit-paid");
    const attachments = [{ filename: `Peak-and-Palm-${booking.ref}.pdf`, content: pdf, contentType: "application/pdf" }];
    const guest = await sendEmail({ to: [booking.email], ...guestConfirmed(booking), attachments });
    const admin = await sendEmail({ to: notifyEmails(), ...adminEvent(booking, "Booking confirmed"), attachments });
    return guest.sent && admin.sent;
  });
}

/** Only sent if the host can’t accept: the deposit has been refunded. */
export async function notifyDeclined(stripe: Stripe, booking: Booking) {
  return once(stripe, booking.paymentIntentId, "mailedDeclined", async () => {
    const guest = await sendEmail({ to: [booking.email], ...guestDeclinedRefunded(booking) });
    const admin = await sendEmail({ to: notifyEmails(), ...adminEvent(booking, "Booking declined, deposit refunded") });
    return guest.sent && admin.sent;
  });
}
