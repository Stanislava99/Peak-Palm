import type { PropertyId } from "./properties";

/** Share of the direct price paid at checkout. */
export const DEPOSIT_RATE = 0.5;
export const DEPOSIT_LABEL = `${Math.round(DEPOSIT_RATE * 100)}%`;

/** Card holds expire after about 7 days, so the host must accept before then. */
export const HOLD_DAYS = 7;
/** The other half is paid in cash at the house. */
export const BALANCE_WHEN = "in cash at check-in";
/** What the guest is told about response time. */
export const HOST_REPLY = "within 48 hours";

/**
 * ⚠️ PLACEHOLDER — replace with your real cancellation policy before going live.
 * Shown on the checkout page and the guest must accept it.
 */
export const CANCELLATION_POLICY = [
  "Free cancellation up to 30 days before check-in: the deposit is refunded in full.",
  "Cancelling within 30 days of check-in: the deposit is not refunded.",
  "The remaining 50% is paid in cash at check-in.",
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

export function splitPayment(directTotal: number) {
  const deposit = Math.round(directTotal * DEPOSIT_RATE);
  return { deposit, balance: directTotal - deposit };
}
