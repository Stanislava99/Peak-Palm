import type Stripe from "stripe";
import { rememberAccount, stripeAccounts } from "./stripe";

/** Tag on every payment this site creates (kept here so this file has no other imports). */
export const SITE_TAG = "peakandpalm";

const LOOKBACK_DAYS = 550;
const MAX_INTENTS = 2000;

/**
 * Every payment this site created, newest first, read with Stripe's LIST API.
 * Stripe's search API is NOT used for this: its index lags behind (Stripe: "don't use search for
 * read-after-write flows"), so a booking paid a moment ago could be missing from /admin and from
 * the blocked dates. The list API always returns current data.
 */
export async function listSiteIntents(kind?: "deposit" | "balance", stripeClient?: Stripe | null): Promise<Stripe.PaymentIntent[]> {
  const accounts = stripeClient ? [stripeClient] : stripeAccounts().map((a) => a.stripe);
  const since = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 86_400;
  const out: Stripe.PaymentIntent[] = [];
  for (const stripe of accounts) {
    let startingAfter: string | undefined;
    for (let page = 0; page < MAX_INTENTS / 100; page += 1) {
      const result = await stripe.paymentIntents.list({
        limit: 100,
        created: { gte: since },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const intent of result.data) {
        if (intent.metadata?.site !== SITE_TAG) continue;
        if (kind && intent.metadata.kind !== kind) continue;
        out.push(rememberAccount(intent, stripe));
      }
      if (!result.has_more || !result.data.length) break;
      startingAfter = result.data[result.data.length - 1].id;
    }
  }
  return out.sort((a, b) => b.created - a.created);
}
