"use client";

import { useEffect } from "react";
import { track, trackFunnel, type TrackEvent } from "@/lib/track";
import type { FunnelStay, FunnelStep } from "@/lib/funnel";

/**
 * Sends one analytics event when a page loads (e.g. "Booking paid" on the thank-you page).
 * `onceKey` stops a reload from counting twice; it is only kept in this browser tab, never sent.
 */
export function TrackOnce({
  event,
  data,
  onceKey,
  funnel,
}: {
  event: TrackEvent;
  /** Also send this booking-funnel step to Umami (Vercel gets it from the server instead). */
  funnel?: { step: FunnelStep; stay: FunnelStay };
  data?: Record<string, string | number | boolean>;
  onceKey?: string;
}) {
  useEffect(() => {
    if (onceKey) {
      try {
        const key = `tracked:${event}:${onceKey}`;
        if (window.sessionStorage.getItem(key)) return;
        window.sessionStorage.setItem(key, "1");
      } catch {
        /* storage unavailable: send anyway */
      }
    }
    track(event, data);
    if (funnel) trackFunnel(funnel.step, funnel.stay, { vercel: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
