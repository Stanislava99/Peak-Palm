import { track } from "@vercel/analytics/server";
import { analyticsWebsiteId } from "./analytics";
import { funnelProps, umamiFunnelProps, type FunnelProps, type FunnelStay, type FunnelStep } from "./funnel";

/**
 * Umami rejects requests without a browser-like User-Agent, and Stripe's own ("Stripe/1.0 (+https://…)")
 * counts as a bot. Server events therefore use this fixed one; their device/country columns in Umami
 * are meaningless, only their counts matter.
 */
const SERVER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function sendUmami(step: FunnelStep, stay: FunnelStay, headers: Headers, extra: FunnelProps = {}) {
  const website = analyticsWebsiteId();
  if (!website) return; // analytics off here (local dev, previews, or the live site without its own ID)
  const hostname = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  const response = await fetch("https://cloud.umami.is/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": SERVER_UA },
    body: JSON.stringify({
      type: "event",
      payload: { website, hostname, url: "/checkout", language: "en", name: step, data: umamiFunnelProps(stay, extra) },
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Umami answered ${response.status}`);
}

/**
 * Sends a booking funnel event from the server, where the browser may already have left for Stripe
 * or never come back. Never throws: analytics must not break a payment. Outside Vercel (local dev)
 * the Vercel library only logs the event to the console.
 * `headers` should be the request's, so Vercel can attribute the event to a device and country
 * (for Stripe webhooks that is Stripe's server, which is fine: only the counts matter there).
 * `umami: true` also sends it to Umami, for steps the browser can't see (payment failed on Stripe).
 */
export async function trackFunnelServer(
  step: FunnelStep,
  stay: FunnelStay,
  headers: Headers,
  options: { umami?: boolean; data?: FunnelProps } = {},
): Promise<void> {
  const jobs: Array<Promise<unknown>> = [track(step, funnelProps(stay), { headers })];
  if (options.umami) jobs.push(sendUmami(step, stay, headers, options.data));
  for (const result of await Promise.allSettled(jobs)) {
    if (result.status === "rejected") console.warn("Analytics event not sent", step, (result.reason as Error)?.message);
  }
}
