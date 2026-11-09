import type Stripe from "stripe";
import type { Booking } from "./bookings";
import { sendEmail } from "./email";
import { sendOnce } from "./send-once";
import { adminEvent, adminNewRequest, guestConfirmed, guestDeclinedRefunded, guestDepositReceived } from "./email-templates";
import { confirmationPdf } from "./pdf/confirmation";
import { notifyEmails } from "./site-config";

/** Sends an email (or pair) once per payment, remembered on the payment itself (see send-once.ts). */
async function once(stripe: Stripe, intentId: string, flag: string, send: () => Promise<boolean>) {
  return sendOnce(stripe, intentId, flag, send);
}

/**
 * Deposit paid: hosts get "New booking, please confirm", the guest gets "Deposit received".
 * Each is sent once (flags on the payment); `force` sends again (the admin's "Resend emails").
 * Returns false if an email could not be sent (the webhook then answers 500 so Stripe retries).
 */
export async function notifyDepositPaid(stripe: Stripe, booking: Booking, options: { force?: boolean } = {}) {
  const send = (flag: string, job: () => Promise<boolean>) => sendOnce(stripe, booking.paymentIntentId, flag, job, { force: options.force });
  const hosts = await send("mailedRequest", async () => {
    const r = await sendEmail({ to: notifyEmails(), replyTo: booking.email, ...adminNewRequest(booking) });
    return r.sent || r.error === "email not configured";
  });
  const guest = booking.email
    ? await send("mailedGuestPending", async () => {
        const r = await sendEmail({ to: [booking.email], ...guestDepositReceived(booking) });
        return r.sent || r.error === "email not configured";
      })
    : true;
  return hosts && guest;
}

/** The guest’s first email: booking confirmed, with the branded PDF. */
export async function notifyConfirmed(stripe: Stripe, booking: Booking, options: { force?: boolean } = {}) {
  return sendOnce(stripe, booking.paymentIntentId, "mailedConfirmed", async () => {
    const pdf = await confirmationPdf(booking, "deposit-paid");
    const attachments = [{ filename: `Sea-and-Ski-${booking.ref}.pdf`, content: pdf, contentType: "application/pdf" }];
    const guest = await sendEmail({ to: [booking.email], ...guestConfirmed(booking), attachments });
    const admin = await sendEmail({ to: notifyEmails(), ...adminEvent(booking, "Booking confirmed"), attachments });
    return guest.sent && admin.sent;
  }, options);
}

/** Only sent if the host can’t accept: the deposit has been refunded. */
export async function notifyDeclined(stripe: Stripe, booking: Booking) {
  return once(stripe, booking.paymentIntentId, "mailedDeclined", async () => {
    const guest = await sendEmail({ to: [booking.email], ...guestDeclinedRefunded(booking) });
    const admin = await sendEmail({ to: notifyEmails(), ...adminEvent(booking, "Booking declined, deposit refunded") });
    return guest.sent && admin.sent;
  });
}
