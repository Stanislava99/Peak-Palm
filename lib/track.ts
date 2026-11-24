/** Client-side helper for custom analytics events. Safe to call when analytics is off. */
import { track as vercelTrack } from "@vercel/analytics";
import { funnelProps, stripeTimeBand, umamiFunnelProps, type FunnelProps, type FunnelStay, type FunnelStep } from "./funnel";

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
  | "Rental reservation sent"
  | "Choose dates click"
  | "Airbnb click"
  | "Booking.com click"
  | "WhatsApp click"
  | "Phone click"
  | "Email click"
  | "Social click";

const queue: Array<[TrackEvent | FunnelStep, EventData | undefined]> = [];
let flushing = false;

/** Sends an event; if the Umami script hasn't loaded yet, retries for a few seconds. */
export function track(name: TrackEvent | FunnelStep, data?: EventData) {
  if (typeof window === "undefined") return;
  if (typeof window.umami?.track === "function") {
    try {
      window.umami.track(name, data);
    } catch {
      /* analytics must never break the page */
    }
    return;
  }
  // Not loaded yet (or analytics is off here): queue it. Events sent as a page opens can run before
  // the Umami <script> tag is even added; the queue is simply dropped if Umami never appears.
  queue.push([name, data]);
  if (flushing) return;
  flushing = true;
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    if (typeof window.umami?.track === "function" || tries > 20) {
      window.clearInterval(timer);
      flushing = false;
      const pending = queue.splice(0);
      if (typeof window.umami?.track === "function") for (const [n, d] of pending) track(n, d);
    }
  }, 250);
}

type FunnelOptions = {
  /** false when the server already sends this step to Vercel. */
  vercel?: boolean;
  /** Step-specific detail for Umami (never personal data). */
  data?: FunnelProps;
  /** "start": the guest is being sent to Stripe; "end": back from Stripe (paid or cancelled). */
  stripe?: "start" | "end";
};

/**
 * Payment attempts and time on Stripe's page, remembered in this browser tab only (sessionStorage,
 * never sent anywhere except as the attempt number and a time band).
 */
function stripeVisit(stay: FunnelStay, phase: "start" | "end"): FunnelProps {
  const key = `stripe:${stay.house}|${stay.checkIn}|${stay.checkOut}`;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(key) ?? "null") as { at: number; attempt: number } | null;
    if (phase === "start") {
      const attempt = (saved?.attempt ?? 0) + 1;
      window.sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), attempt }));
      return { attempt };
    }
    if (!saved) return {};
    return { attempt: saved.attempt, onStripe: stripeTimeBand(Date.now() - saved.at) };
  } catch {
    return {};
  }
}

/**
 * One booking-funnel step (see lib/funnel.ts for names and properties), sent to Umami and to
 * Vercel Web Analytics. The older Umami events above keep their own names and data.
 */
export function trackFunnel(step: FunnelStep, stay: FunnelStay, options: FunnelOptions = {}) {
  if (typeof window === "undefined") return;
  const visit = options.stripe ? stripeVisit(stay, options.stripe) : {};
  track(step, umamiFunnelProps(stay, { ...visit, ...options.data }));
  if (options.vercel !== false) trackVercel(step, stay);
}

function trackVercel(step: FunnelStep, stay: FunnelStay, tries = 0) {
  // Effects in the page run before the <Analytics> component in the layout has set up window.va
  // (and its beforeSend, which strips query strings); until then the library drops events. Wait for it.
  if (!(window as { va?: unknown }).va) {
    if (tries < 40) window.setTimeout(() => trackVercel(step, stay, tries + 1), 100);
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
