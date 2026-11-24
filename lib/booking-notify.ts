import type Stripe from "stripe";
import type { Booking } from "./bookings";
import { sendEmail } from "./email";
import { sendOnce } from "./send-once";
import { adminEvent, adminNewRequest, guestCancelledRefunded, guestConfirmed, guestDeclinedRefunded, guestDepositReceived } from "./email-templates";
import { confirmationPdf } from "./pdf/confirmation";
import { notifyEmails } from "./site-config";
import { notifyRentalForBooking } from "./rental-notify";

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
  // Skis / ski school added at checkout (Villa Kaja): the reservation PDF goes to the hosts too.
  const rental = await notifyRentalForBooking(stripe, booking, options).catch((error) => {
    console.error("Rental reservation email failed", (error as Error).message);
    return false;
  });
  return hosts && guest && rental;
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

/** The guest cancelled with their link within the free window: deposit refunded, hosts told. */
export async function notifyCancelled(stripe: Stripe, booking: Booking, refunded?: number) {
  return once(stripe, booking.paymentIntentId, "mailedCancelled", async () => {
    const guest = await sendEmail({ to: [booking.email], ...guestCancelledRefunded(booking, refunded) });
    const admin = await sendEmail({
      to: notifyEmails(),
      ...adminEvent(booking, `Guest cancelled within 48 hours, deposit refunded minus the Stripe fee${refunded !== undefined ? ` (${(booking.deposit - refunded).toFixed(2)} € kept, ${refunded.toFixed(2)} € refunded)` : ""}. Please free the dates on Airbnb and Booking.com if you blocked them.`),
    });
    return guest.sent && admin.sent;
  });
}
