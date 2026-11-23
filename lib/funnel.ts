/**
 * Booking funnel events for Vercel Web Analytics (Analytics → Events in the Vercel dashboard).
 * Shared by the browser (lib/track.ts) and the server (lib/funnel-server.ts).
 *
 * Each step sends one event, numbered so the list reads in funnel order:
 *   1 dates picked → 2 checkout clicked → 3 form filled → 4 form submitted
 *   → 5 payment started (or 5 request sent, when online payment is off)
 *   → 6 payment succeeded / failed / cancelled
 *
 * Vercel limits custom data per event by plan: Pro allows 2 properties, Pro with Web Analytics Plus
 * or Enterprise allow 8 (Hobby records no custom events at all). So by default every event carries
 * exactly two: `house` (kaja | janis) and `stay` ("2027-02 · 7n · 6g": check-in month, nights,
 * guests). With NEXT_PUBLIC_VERCEL_ANALYTICS_PLUS=1 it also sends month, nights, guests and a
 * lead-time bucket as separate properties, so each can be filtered on its own.
 *
 * Privacy: only the house and coarse stay values. Never names, emails, phones, exact dates or
 * booking references.
 */
import type { PropertyId } from "./properties";

export type FunnelStep =
  | "Booking 1: dates picked"
  | "Booking 2: checkout clicked"
  | "Booking 3: form filled"
  | "Booking 4: form submitted"
  | "Booking 5: payment started"
  | "Booking 5: request sent"
  | "Booking 6: payment succeeded"
  | "Booking 6: payment failed"
  | "Booking 6: payment cancelled";

export type FunnelStay = { house: PropertyId; checkIn: string; checkOut: string; guests: number };
export type FunnelProps = Record<string, string | number>;

const DAY = 86_400_000;

function leadBucket(days: number): string {
  if (days <= 7) return "0-7d";
  if (days <= 30) return "8-30d";
  if (days <= 90) return "31-90d";
  return "90d+";
}

/** The custom data for one funnel event (2 properties, or 6 with Web Analytics Plus). */
export function funnelProps({ house, checkIn, checkOut, guests }: FunnelStay, now = Date.now()): FunnelProps {
  const month = checkIn.slice(0, 7);
  const nights = Math.max(0, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / DAY));
  const props: FunnelProps = { house, stay: `${month} · ${nights}n · ${guests}g` };
  if (process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_PLUS === "1") {
    const today = Date.parse(new Date(now).toISOString().slice(0, 10));
    props.month = month;
    props.nights = nights;
    props.guests = guests;
    props.lead = leadBucket(Math.round((Date.parse(checkIn) - today) / DAY));
  }
  return props;
}
