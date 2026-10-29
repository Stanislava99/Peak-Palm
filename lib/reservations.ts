import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fetchAirbnbCalendar, type CalendarDay } from "./listings";
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

export async function calendarWithHolds(property: PropertyId = "kaja"): Promise<CalendarDay[]> {
  const [days, reservations] = await Promise.all([
    fetchAirbnbCalendar(property),
    readReservations(property),
  ]);
  const held = heldNights(reservations);
  return days.map((day) =>
    held.has(day.date) ? { ...day, available: false, checkin: false } : day,
  );
}
