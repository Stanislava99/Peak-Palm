import type { Freshness } from "./ical";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fetchAirbnbCalendar, type CalendarDay } from "./listings";
import { directBookedNights } from "./bookings";
import { blockedNights } from "./blocked-nights";
import { fetchBookingNights, type ChannelNights } from "./ical";
import type { PropertyId } from "./properties";
import { eachNight } from "./stay";

export type Reservation = {
  id: string;
  property: PropertyId;
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  phone: string;
  note: string;
  /** Prices at the moment of the request, in EUR. Null if Airbnb gave no price. */
  airbnbTotal: number | null;
  directTotal: number | null;
  createdAt: string;
};

const filePath = path.join(process.cwd(), "data", "reservations.json");

export async function readReservations(property?: PropertyId): Promise<Reservation[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Reservation[];
    const list = Array.isArray(parsed) ? parsed : [];
    if (!property) return list;
    return list.filter((entry) => (entry.property ?? "kaja") === property);
  } catch {
    return [];
  }
}

export async function saveReservation(entry: Reservation) {
  const current = await readReservations();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify([entry, ...current], null, 2));
}

export function heldNights(reservations: Reservation[]) {
  const nights = new Set<string>();
  for (const reservation of reservations) {
    for (const night of eachNight(reservation.checkIn, reservation.checkOut)) {
      nights.add(night);
    }
  }
  return nights;
}

export function reservationOverlaps(reservations: Reservation[], checkIn: string, checkOut: string) {
  const requested = new Set(eachNight(checkIn, checkOut));
  for (const night of heldNights(reservations)) {
    if (requested.has(night)) return true;
  }
  return false;
}

export type CalendarSources = { booking: ChannelNights["status"] };

/** Marks nights booked elsewhere (Booking.com, direct stays, nights the hosts blocked in admin) as taken. */
export function applyBlockedNights(days: CalendarDay[], blocked: Set<string>) {
  return days.map((day) => (blocked.has(day.date) ? { ...day, available: false, checkin: false } : day));
}

/** `freshness`: how old the Airbnb / Booking.com part may be (see channelCache). Blocks and direct bookings are always read live. */
export async function calendarWithSources(
  property: PropertyId = "kaja",
  freshness: Freshness = "page",
): Promise<{ days: CalendarDay[]; sources: CalendarSources }> {
  const [days, reservations, booking, direct, closed] = await Promise.all([
    fetchAirbnbCalendar(property, freshness),
    readReservations(property),
    fetchBookingNights(property, freshness),
    directBookedNights(property),
    blockedNights(property),
  ]);
  const blocked = new Set([...heldNights(reservations), ...booking.nights, ...direct, ...closed]);
  return { days: applyBlockedNights(days, blocked), sources: { booking: booking.status } };
}

export async function calendarWithHolds(property: PropertyId = "kaja"): Promise<CalendarDay[]> {
  return (await calendarWithSources(property)).days;
}

/**
 * The house pages only need the first few months in their HTML: the calendar fetches the
 * full year from /api/availability as soon as it opens. Keeps each page ~30 KB lighter.
 */
export function firstMonths(days: CalendarDay[], months = 3): CalendarDay[] {
  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, 1)).toISOString().slice(0, 10);
  return days.filter((day) => day.date < cutoff);
}
