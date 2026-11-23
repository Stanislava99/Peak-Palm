/** Client-side helper for custom analytics events. Safe to call when analytics is off. */
import { track as vercelTrack } from "@vercel/analytics";
import { funnelProps, type FunnelStay, type FunnelStep } from "./funnel";

type EventData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (name: string, data?: EventData) => void };
  }
}

/** Event names used on the site. Build the funnel in Umami from these. */
export type TrackEvent =
  | "Calendar viewed"
  | "Calendar used"
  | "Dates selected"
  | "Price shown"
  | "Price failed"
  | "Continue to checkout"
  | "Checkout started"
  | "Pay deposit clicked"
  | "Checkout error"
  | "Booking request sent"
  | "Booking paid"
  | "Question sent"
  | "Choose dates click"
  | "Airbnb click"
  | "Booking.com click"
  | "WhatsApp click"
  | "Phone click"
  | "Email click"
  | "Social click";

const queue: Array<[TrackEvent, EventData | undefined]> = [];
let flushing = false;

/** Sends an event; if the Umami script hasn't loaded yet, retries for a few seconds. */
export function track(name: TrackEvent, data?: EventData) {
  if (typeof window === "undefined") return;
  if (window.umami) {
    try {
      window.umami.track(name, data);
    } catch {
      /* analytics must never break the page */
    }
    return;
  }
  if (!document.querySelector("script[data-website-id]")) return; // analytics off on this deployment
  queue.push([name, data]);
  if (flushing) return;
  flushing = true;
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    if (window.umami || tries > 20) {
      window.clearInterval(timer);
      flushing = false;
      const pending = queue.splice(0);
      if (window.umami) for (const [n, d] of pending) track(n, d);
    }
  }, 250);
}

/**
 * One booking-funnel step for Vercel Web Analytics (see lib/funnel.ts for names and properties).
 * Separate from the Umami events above, which keep their own names and data.
 */
export function trackFunnel(step: FunnelStep, stay: FunnelStay, tries = 0) {
  if (typeof window === "undefined") return;
  // Effects in the page run before the <Analytics> component in the layout has set up window.va
  // (and its beforeSend, which strips query strings); until then the library drops events. Wait for it.
  if (!(window as { va?: unknown }).va) {
    if (tries < 40) window.setTimeout(() => trackFunnel(step, stay, tries + 1), 100);
    return;
  }
  try {
    vercelTrack(step, funnelProps(stay));
  } catch {
    /* analytics must never break the page */
  }
}

/** Which house a page belongs to, from its path. */
export function houseFromPath(path: string): string {
  if (path.startsWith("/villa-kaja")) return "kaja";
  if (path.startsWith("/janis")) return "janis";
  if (path === "/" || path === "") return "home";
  return path.replace(/^\//, "").split("/")[0] || "home";
}
