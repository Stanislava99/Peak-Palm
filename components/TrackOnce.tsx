"use client";

import { useEffect } from "react";
import { track, type TrackEvent } from "@/lib/track";

/**
 * Sends one analytics event when a page loads (e.g. "Booking paid" on the thank-you page).
 * `onceKey` stops a reload from counting twice; it is only kept in this browser tab, never sent.
 */
export function TrackOnce({
  event,
  data,
  onceKey,
}: {
  event: TrackEvent;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
