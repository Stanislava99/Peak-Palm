import type { PropertyId } from "./properties";
import { eachNight } from "./stay";

/**
 * Booking.com (and most other channels) share availability as a private iCal link:
 * Extranet → Rates & Availability → Sync calendars → Export calendar.
 * The links are secret, so they live in environment variables, not in the code.
 */
const BOOKING_ICAL_ENV: Record<PropertyId, string> = {
  kaja: "BOOKING_ICAL_KAJA",
  janis: "BOOKING_ICAL_JANIS",
};

export function bookingIcalUrl(property: PropertyId): string | null {
  const value = process.env[BOOKING_ICAL_ENV[property]]?.trim();
  return value && /^https?:\/\//.test(value) ? value : null;
}

function toIsoDate(value: string): string | null {
  const match = value.match(/(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** Every night covered by a VEVENT (DTSTART inclusive, DTEND exclusive). Exported for tests. */
export function parseIcalNights(text: string): Set<string> {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const nights = new Set<string>();
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const start = toIsoDate(body.match(/^DTSTART[^:\n]*:([^\r\n]+)/m)?.[1] ?? "");
    let end = toIsoDate(body.match(/^DTEND[^:\n]*:([^\r\n]+)/m)?.[1] ?? "");
    if (!start) continue;
    if (!end || end <= start) {
      const next = new Date(`${start}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      end = next.toISOString().slice(0, 10);
    }
    for (const night of eachNight(start, end)) nights.add(night);
  }
  return nights;
}

/**
 * Airbnb's own calendar export (Listing → Availability → Connect calendars → Export calendar).
 * The official way to read Airbnb availability: reservations and blocked nights (no prices).
 */
const AIRBNB_ICAL_ENV: Record<PropertyId, string> = {
  kaja: "AIRBNB_ICAL_KAJA",
  janis: "AIRBNB_ICAL_JANIS",
};

/**
 * How old Airbnb / Booking.com export data may be:
 * - "live": read now. Admin and the final check before a guest pays.
 * - "minute": a copy up to 1 minute old. The guest calendar (Airbnb's own export lags more than that,
 *   and it spares Airbnb a request on every page view). Your admin blocks and direct bookings are never cached.
 * - "page": a 5-minute copy for pre-built pages, which re-check when the calendar opens anyway
 *   (reading live there would make those pages rebuild on every visit).
 */
export type Freshness = "live" | "minute" | "page";
export function channelCache(freshness: Freshness): RequestInit {
  if (freshness === "live") return { cache: "no-store" };
  return { next: { revalidate: freshness === "minute" ? 60 : 300 } };
}

export function airbnbIcalUrl(property: PropertyId): string | null {
  const value = process.env[AIRBNB_ICAL_ENV[property]]?.trim();
  return value && /^https:\/\/([a-z0-9-]+\.)*airbnb\.[a-z.]+\//i.test(value) ? value : null;
}

/** Nights taken on Airbnb from the export link, or null if the link isn't set or didn't answer. */
export async function fetchAirbnbIcalNights(property: PropertyId, freshness: Freshness = "page"): Promise<Set<string> | null> {
  const url = airbnbIcalUrl(property);
  if (!url) return null;
  try {
    const response = await fetch(url, { headers: { Accept: "text/calendar, text/plain, */*" }, ...channelCache(freshness) });
    if (!response.ok) {
      console.warn("Airbnb iCal request failed", { property, status: response.status });
      return null;
    }
    const text = await response.text();
    if (!text.includes("BEGIN:VCALENDAR")) {
      console.warn("Airbnb iCal response was not a calendar", { property });
      return null;
    }
    return parseIcalNights(text);
  } catch (error) {
    console.warn("Airbnb iCal request threw", { property, error: (error as Error).message });
    return null;
  }
}

export type ChannelNights = { nights: Set<string>; status: "synced" | "not-configured" | "failed" };

/** Nights already booked on Booking.com for this house. */
export async function fetchBookingNights(property: PropertyId, freshness: Freshness = "page"): Promise<ChannelNights> {
  const url = bookingIcalUrl(property);
  if (!url) return { nights: new Set(), status: "not-configured" };
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/calendar, text/plain, */*" },
      ...channelCache(freshness),
    });
    if (!response.ok) return { nights: new Set(), status: "failed" };
    const text = await response.text();
    if (!text.includes("BEGIN:VCALENDAR")) return { nights: new Set(), status: "failed" };
    return { nights: parseIcalNights(text), status: "synced" };
  } catch {
    return { nights: new Set(), status: "failed" };
  }
}
