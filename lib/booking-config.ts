import type { PropertyId } from "./properties";

/** Share of the direct price paid at checkout. */
export const DEPOSIT_RATE = 0.5;
export const DEPOSIT_LABEL = `${Math.round(DEPOSIT_RATE * 100)}%`;

/** Card holds expire after about 7 days, so the host must accept before then. */
export const HOLD_DAYS = 7;
/** The other half is paid on site, on arrival. */
export const BALANCE_WHEN = "paid on site, on arrival";
/** What the guest is told about response time. */
export const HOST_REPLY = "within 48 hours";
/** How fast Frosina answers questions (ask form, phone, email). Booking confirmations use HOST_REPLY. */
export const QUESTION_REPLY = "within 24 hours";

/** Guests may cancel within this many hours of paying the deposit and get it back, minus Stripe's fee. */
export const CANCEL_HOURS = 48;

/** Stripe's fee for a standard European card payment, which Stripe keeps when a payment is refunded. */
export const STRIPE_FEE_PERCENT = 0.015;
export const STRIPE_FEE_FIXED = 0.25;
export const STRIPE_FEE_LABEL = "1.5% + €0.25";

/** Stripe's fee on an amount, in euros, rounded to the cent. */
export function stripeFeeOn(amount: number) {
  return amount > 0 ? Math.round((amount * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED) * 100) / 100 : 0;
}

/**
 * Estimate of what a guest gets back when they cancel (standard European card fee). The refund itself
 * uses the fee Stripe actually charged (lib/stripe-fee.ts), so a cancellation costs the hosts nothing. (A booking the host declines is always refunded in full.)
 */
export function cancellationRefund(deposit: number) {
  const fee = Math.min(stripeFeeOn(deposit), deposit);
  return { fee, refund: Math.round((deposit - fee) * 100) / 100 };
}

/** Shown above the policy on the checkout page and the cancel page. */
export const CANCELLATION_INTRO = "Due to the seasonal nature of both properties, we have a strict cancellation policy:";

/**
 * The cancellation policy (decided 10 Nov 2026). Shown on the checkout page (the guest must accept it),
 * the confirmation PDF and the cancel page. Guests cancel with the link in their "Deposit received" email.
 */
export const CANCELLATION_POLICY = [
  `Guests may cancel within ${CANCEL_HOURS} hours of making the reservation and receive a refund of the deposit, minus the card payment fee Stripe charged on it (about ${STRIPE_FEE_LABEL} for European cards; more for other cards or currencies).`,
  `Cancellations after ${CANCEL_HOURS} hours of reservation are non-refundable.`,
];

export const HOUSE_RULES: Record<PropertyId, string[]> = {
  kaja: [
    "Check-in after 4:00 pm, check-out by 11:00 am.",
    "The whole chalet is reserved for your group only.",
    "Quiet hours overnight on a residential street.",
  ],
  janis: [
    "Self check-in with a lockbox.",
    "Quiet hours are 11:00 pm to 8:00 am.",
    "Barbecues are not allowed. The house is reserved for your group only.",
  ],
};

/** The optional, unticked offers box at checkout (also quoted in the privacy notice). */
export const OFFERS_LINE =
  "Send me occasional offers and news for Villa Kaja and Jani’s Beach House by email. You can unsubscribe at any time.";

export function splitPayment(directTotal: number) {
  const deposit = Math.round(directTotal * DEPOSIT_RATE);
  return { deposit, balance: directTotal - deposit };
}
