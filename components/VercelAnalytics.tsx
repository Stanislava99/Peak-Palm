"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { UNTRACKED_PATHS } from "@/lib/analytics";

/**
 * Vercel Web Analytics (cookieless), next to Umami. Only reports on the live Vercel deployment where
 * Web Analytics is switched on in the project. Skips admin and guest-only pages, and drops query strings
 * and hashes so tokens in links (reviews, cancellations, unsubscribe) never leave the site.
 */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (UNTRACKED_PATHS.test(url.pathname)) return null;
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}

export function VercelAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
