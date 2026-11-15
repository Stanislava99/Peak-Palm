import type Stripe from "stripe";
import { cancellationRefund } from "./booking-config";

/**
 * The fee Stripe actually charged for a payment (in euros), read from the payment's balance
 * transaction. It depends on the card (EU cards are cheapest; UK and non-European cards cost more)
 * and on currency conversion, so it can be well above the standard 1.5% + €0.25.
 * Returns null when Stripe hasn't settled the payment yet or the currencies differ.
 */
export async function chargedStripeFee(stripe: Stripe, intent: Stripe.PaymentIntent): Promise<number | null> {
  try {
    const full = await stripe.paymentIntents.retrieve(intent.id, { expand: ["latest_charge.balance_transaction"] });
    const charge = full.latest_charge as Stripe.Charge | null;
    const tx = charge && typeof charge === "object" ? (charge.balance_transaction as Stripe.BalanceTransaction | null) : null;
    if (!tx || typeof tx !== "object" || typeof tx.fee !== "number") return null;
    if (tx.currency.toLowerCase() !== full.currency.toLowerCase()) return null;
    return tx.fee / 100;
  } catch {
    return null;
  }
}

/**
 * The guest's refund when they cancel: the deposit minus the fee Stripe really kept, so a
 * cancellation costs the hosts nothing. Falls back to the standard-fee estimate if Stripe
 * can't tell yet.
 */
export async function guestCancellationRefund(stripe: Stripe, intent: Stripe.PaymentIntent, deposit: number) {
  const actual = await chargedStripeFee(stripe, intent);
  if (actual === null) return { ...cancellationRefund(deposit), exact: false };
  const fee = Math.min(Math.round(actual * 100) / 100, deposit);
  return { fee, refund: Math.round((deposit - fee) * 100) / 100, exact: true };
}
