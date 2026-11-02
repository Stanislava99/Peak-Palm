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

export type ChannelNights = { nights: Set<string>; status: "synced" | "not-configured" | "failed" };

/** Nights already booked on Booking.com for this house. */
export async function fetchBookingNights(property: PropertyId): Promise<ChannelNights> {
  const url = bookingIcalUrl(property);
  if (!url) return { nights: new Set(), status: "not-configured" };
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/calendar, text/plain, */*" },
      next: { revalidate: 900 },
    });
    if (!response.ok) return { nights: new Set(), status: "failed" };
    const text = await response.text();
    if (!text.includes("BEGIN:VCALENDAR")) return { nights: new Set(), status: "failed" };
    return { nights: parseIcalNights(text), status: "synced" };
  } catch {
    return { nights: new Set(), status: "failed" };
  }
}
