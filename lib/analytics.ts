/**
 * Visitor analytics (Umami Cloud, cookieless).
 * - TEST site: reports to the Umami website registered for peak-and-palm-test.vercel.app (default ID below).
 * - LIVE site: reports only when UMAMI_WEBSITE_ID is set on the live Vercel project, so live and test
 *   numbers never mix by accident. Give the live site its own Umami website.
 * - Never on Vercel preview deployments or localhost. ANALYTICS=off switches it off anywhere.
 * - The script and its data go through this site (/stats/… is proxied to Umami in next.config.ts),
 *   so the Content Security Policy stays 'self' and ad blockers drop fewer visits.
 * - Never send names, emails, phone numbers or booking references in events.
 * Dashboard: https://cloud.umami.is
 */
import { appEnv } from "./site-config";

/** Umami website for the TEST site (peak-and-palm-test.vercel.app). */
const TEST_WEBSITE_ID = "5640458b-efcb-443e-aef5-850df991d8ca";

/** Umami website ID when analytics should run on this deployment, otherwise null. */
export function analyticsWebsiteId(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (process.env.ANALYTICS?.trim().toLowerCase() === "off") return null;
  if (process.env.VERCEL_ENV === "preview") return null;
  const configured = process.env.UMAMI_WEBSITE_ID?.trim();
  if (configured) return configured;
  return appEnv() === "test" ? TEST_WEBSITE_ID : null;
}

/** Pages that are never tracked (admin, sign-in, guest-only links). */
export const UNTRACKED_PATHS = /^\/(admin|host|review|unsubscribe|cancel)(\/|$)/;
