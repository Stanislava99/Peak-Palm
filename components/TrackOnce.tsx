"use client";

import { useEffect } from "react";
import { track, trackFunnel, type TrackEvent } from "@/lib/track";
import type { FunnelProps, FunnelStay, FunnelStep } from "@/lib/funnel";

/**
 * Sends analytics events once when a page loads (e.g. "Booking paid" on the thank-you page).
 * `onceKey` stops a reload from counting twice; it is only kept in this browser tab, never sent.
 */
export function TrackOnce({
  event,
  data,
  onceKey,
  funnel,
}: {
  /** An Umami event with its own name (optional when only a funnel step is sent). */
  event?: TrackEvent;
  data?: Record<string, string | number | boolean>;
  /**
   * A booking-funnel step, sent to Umami (and to Vercel unless `vercel: false`, used where the
   * server already sends it). `stripe: "end"` adds the attempt number and time on Stripe's page.
   */
  funnel?: { step: FunnelStep; stay: FunnelStay; data?: FunnelProps; vercel?: boolean; stripe?: "end" };
  onceKey?: string;
}) {
  useEffect(() => {
    if (onceKey) {
      try {
        const key = `tracked:${event ?? funnel?.step}:${onceKey}`;
        if (window.sessionStorage.getItem(key)) return;
        window.sessionStorage.setItem(key, "1");
      } catch {
        /* storage unavailable: send anyway */
      }
    }
    if (event) track(event, data);
    if (funnel) trackFunnel(funnel.step, funnel.stay, { vercel: funnel.vercel, data: funnel.data, stripe: funnel.stripe });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
