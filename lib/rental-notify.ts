import type Stripe from "stripe";
import type { Booking } from "./bookings";
import { sendEmail } from "./email";
import { adminRental, guestRentalAck } from "./email-templates";
import { rentalPdf, type RentalReservation } from "./pdf/rental";
import { decodeLines } from "./rentals";
import { sendOnce } from "./send-once";
import { notifyEmails } from "./site-config";

/** Emails the reservation PDF to Frosina (the booking inbox), and a copy to the guest if asked. */
export async function sendRentalReservation(r: RentalReservation, options: { guestCopy?: boolean } = {}) {
  const pdf = await rentalPdf(r);
  const attachments = [{ filename: `Ski-rental-${r.ref}.pdf`, content: pdf, contentType: "application/pdf" }];
  const hosts = await sendEmail({ to: notifyEmails(), replyTo: r.email, ...adminRental(r), attachments });
  const guest = options.guestCopy && r.email ? await sendEmail({ to: [r.email], ...guestRentalAck(r), attachments }) : null;
  return { hosts, guest };
}

/**
 * Deposit paid for Villa Kaja with skis / ski school added at checkout: send the reservation PDF
 * to Frosina, once per payment. The lines travel in the payment's metadata ("rental").
 */
export async function notifyRentalForBooking(stripe: Stripe, booking: Booking, options: { force?: boolean } = {}) {
  const intent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);
  const lines = decodeLines(intent.metadata?.rental);
  if (!lines.length) return true;
  return sendOnce(
    stripe,
    booking.paymentIntentId,
    "mailedRental",
    async () => {
      const { hosts } = await sendRentalReservation({
        ref: booking.ref,
        name: booking.name,
        email: booking.email,
        phone: booking.phone,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guests: booking.guests,
        bookedVia: "this website (deposit paid)",
        lines,
      });
      return hosts.sent || hosts.error === "email not configured";
    },
    options,
  );
}
