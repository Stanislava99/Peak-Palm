import { fetchAirbnbCalendar } from "@/lib/listings";
import { getProperty, isPropertyId, type PropertyId } from "@/lib/properties";
import {
  readReservations,
  reservationOverlaps,
  saveReservation,
} from "@/lib/reservations";
import { evaluateStay } from "@/lib/stay";
import { NextResponse } from "next/server";

type Payload = {
  property?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  name?: string;
  email?: string;
  phone?: string;
  note?: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body) {
    return NextResponse.json({ error: "The reservation could not be read." }, { status: 400 });
  }

  const property: PropertyId = isPropertyId(body.property) ? body.property : "kaja";
  const house = getProperty(property);
  const checkIn = body.checkIn ?? "";
  const checkOut = body.checkOut ?? "";
  const guests = Number(body.guests);
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const note = (body.note ?? "").trim().slice(0, 800);

  if (!datePattern.test(checkIn) || !datePattern.test(checkOut)) {
    return NextResponse.json({ error: "Choose a check-in and check-out date." }, { status: 400 });
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > house.maxGuests) {
    return NextResponse.json(
      { error: `Guests must be between 1 and ${house.maxGuests}.` },
      { status: 400 },
    );
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "Add the name for the reservation." }, { status: 400 });
  }
  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Add a valid email so the stay can be confirmed." }, { status: 400 });
  }

  const [days, reservations] = await Promise.all([
    fetchAirbnbCalendar(property),
    readReservations(property),
  ]);
  const verdict = evaluateStay(days, checkIn, checkOut);
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.message }, { status: 409 });
  }
  if (reservationOverlaps(reservations, checkIn, checkOut)) {
    return NextResponse.json(
      { error: "Those nights already have a reservation request. Choose different dates." },
      { status: 409 },
    );
  }

  const id = `${house.reservePrefix}-${Date.now().toString(36).toUpperCase()}`;
  await saveReservation({
    id,
    property,
    checkIn,
    checkOut,
    guests,
    name,
    email,
    phone,
    note,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ id });
}
