/**
 * Booking funnel events, sent to Umami (cloud.umami.is → Events, and a Funnel report) and to Vercel
 * Web Analytics (recorded only on a Vercel Pro team). Shared by the browser (lib/track.ts) and the
 * server (lib/funnel-server.ts).
 *
 * Each step sends one event, numbered so the list reads in funnel order:
 *   1 dates picked → 2 checkout clicked (2 checkout problem: dates gone / no price)
 *   → 3 form filled (3 form left: closed the checkout without sending) → 4 form submitted
 *   (4 payment page error: Stripe page couldn't be opened)
 *   → 5 payment started (or 5 request sent, when online payment is off)
 *   → 6 payment succeeded / failed / cancelled
 *
 * Umami gets house, month, nights, guests, lead (0-7d / 8-30d / 31-90d / 90d+), stay and price band,
 * plus detail per step: see the owner guide (SETUP.md → Analytics) for the full list.
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
  | "Booking 2: checkout problem"
  | "Booking 3: form filled"
  | "Booking 3: form left"
  | "Booking 4: form submitted"
  | "Booking 4: payment page error"
  | "Booking 5: payment started"
  | "Booking 5: request sent"
  | "Booking 6: payment succeeded"
  | "Booking 6: payment failed"
  | "Booking 6: payment cancelled";

export type FunnelStay = {
  house: PropertyId;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** Direct price for the whole stay in EUR, when known (sent to Umami as a price band only). */
  total?: number;
};
export type FunnelProps = Record<string, string | number | boolean>;

const DAY = 86_400_000;

function leadBucket(days: number): string {
  if (days <= 7) return "0-7d";
  if (days <= 30) return "8-30d";
  if (days <= 90) return "31-90d";
  return "90d+";
}

function stayParts({ checkIn, checkOut }: FunnelStay, now: number) {
  if (Number.isNaN(Date.parse(checkIn)) || Number.isNaN(Date.parse(checkOut))) {
    return { month: "none", nights: 0, lead: "none" }; // e.g. checkout opened without dates
  }
  const month = checkIn.slice(0, 7);
  const nights = Math.max(0, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / DAY));
  const today = Date.parse(new Date(now).toISOString().slice(0, 10));
  const lead = leadBucket(Math.round((Date.parse(checkIn) - today) / DAY));
  return { month, nights, lead };
}

/** The custom data for one Vercel funnel event (2 properties, or 6 with Web Analytics Plus). */
export function funnelProps(stay: FunnelStay, now = Date.now()): FunnelProps {
  const { month, nights, lead } = stayParts(stay, now);
  const props: FunnelProps = { house: stay.house, stay: `${month} · ${nights}n · ${stay.guests}g` };
  if (process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_PLUS === "1") {
    props.month = month;
    props.nights = nights;
    props.guests = stay.guests;
    props.lead = lead;
  }
  return props;
}

/** Price band for the whole stay, so the Properties view groups stays instead of listing every price. */
export function priceBand(total: number): string {
  if (total < 500) return "€0-499";
  if (total < 1000) return "€500-999";
  if (total < 2000) return "€1000-1999";
  if (total < 4000) return "€2000-3999";
  return "€4000+";
}

/** Minutes a guest spent on Stripe's payment page, in bands. */
export function stripeTimeBand(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 1) return "<1 min";
  if (minutes < 3) return "1-3 min";
  if (minutes < 10) return "3-10 min";
  return "10+ min";
}

/**
 * The custom data for one Umami funnel event: no property limit to work around, so all of it,
 * plus any step-specific detail in `extra` (decline reason, time on Stripe, which field…).
 */
export function umamiFunnelProps(stay: FunnelStay, extra: FunnelProps = {}, now = Date.now()): FunnelProps {
  const { month, nights, lead } = stayParts(stay, now);
  return {
    house: stay.house,
    month,
    nights,
    guests: stay.guests,
    lead,
    stay: `${month} · ${nights}n · ${stay.guests}g`,
    ...(stay.total ? { price: priceBand(stay.total) } : {}),
    ...extra,
  };
}
