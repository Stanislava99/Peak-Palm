import { track } from "@vercel/analytics/server";
import { funnelProps, type FunnelStay, type FunnelStep } from "./funnel";

/**
 * Sends a booking funnel event from the server (payment started / succeeded / failed), where the
 * browser may already have left for Stripe or never come back. Never throws: analytics must not
 * break a payment. Outside Vercel (local dev) the library only logs the event to the console.
 * `headers` should be the request's, so Vercel can attribute the event to a device and country
 * (for Stripe webhooks that is Stripe's server, which is fine: only the counts matter there).
 */
export async function trackFunnelServer(step: FunnelStep, stay: FunnelStay, headers: Headers): Promise<void> {
  try {
    await track(step, funnelProps(stay), { headers });
  } catch (error) {
    console.warn("Analytics event not sent", step, (error as Error).message);
  }
}
