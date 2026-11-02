import { getProperty, isPropertyId, type PropertyId } from "@/lib/properties";
import {
  calendarWithSources,
  readReservations,
  reservationOverlaps,
  saveReservation,
} from "@/lib/reservations";
import { fetchStayQuote } from "@/lib/pricing";
import { evaluateStay } from "@/lib/stay";
import { sendEmail } from "@/lib/email";
import { HOUSE_NAMES, adminMessage, guestRequestAck } from "@/lib/email-templates";
import { guard } from "@/lib/security";
import { notifyEmails } from "@/lib/site-config";
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
  const blocked = guard(request, "reserve", [[5, 10 * 60_000], [20, 24 * 3600_000]]);
  if (blocked) return blocked;
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

  const [{ days }, reservations] = await Promise.all([
    calendarWithSources(property),
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

  const priced = await fetchStayQuote(property, checkIn, checkOut, guests);
  const quote = priced.ok ? priced.quote : null;

  const id = `${house.reservePrefix}-${Date.now().toString(36).toUpperCase()}`;
  const record = {
    id,
    property,
    checkIn,
    checkOut,
    guests,
    name,
    email,
    phone,
    note,
    airbnbTotal: quote?.airbnbTotal ?? null,
    directTotal: quote?.directTotal ?? null,
    createdAt: new Date().toISOString(),
  };
  // Email is the main channel (it works on Vercel); the file copy is a local backup only.
  const saved = await saveReservation(record).then(() => true, () => false);
  const houseName = HOUSE_NAMES[property];
  const notified = await sendEmail({
    to: notifyEmails(),
    replyTo: email,
    ...adminMessage("request", {
      house: houseName,
      reference: id,
      "check-in": checkIn,
      "check-out": checkOut,
      guests: String(guests),
      name,
      email,
      phone: phone || "—",
      message: note || "—",
      "direct price": quote ? `€${quote.directTotal} (Airbnb €${quote.airbnbTotal})` : "not available",
    }),
  });
  if (!notified.sent && !saved) {
    return NextResponse.json(
      { error: "The request could not be sent right now. Please try again in a few minutes." },
      { status: 503 },
    );
  }
  await sendEmail({ to: [email], ...guestRequestAck({ name, house: houseName, checkIn, checkOut, guests, ref: id }) });

  return NextResponse.json({ id, quote });
}
