import { parseLines } from "@/lib/rentals";
import { sendRentalReservation } from "@/lib/rental-notify";
import { NO_STORE, cleanText, guard } from "@/lib/security";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Ski equipment / ski school reservation from the Villa Kaja page, for guests who booked elsewhere
 * (Airbnb, Booking.com, by phone…). Nothing is paid: the PDF goes to Frosina, with a copy to the guest.
 */
type Payload = {
  name?: string;
  email?: string;
  phone?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  bookedVia?: string;
  bookingRef?: string;
  note?: string;
  lines?: unknown;
  /** Honeypot. */
  website?: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VIA = ["Airbnb", "Booking.com", "Directly with Frosina", "This website", "Other"];

export async function POST(request: Request) {
  const blocked = await guard(request, "rental", [
    [5, 10 * 60_000],
    [20, 24 * 3600_000],
  ]);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body || body.website) return NextResponse.json({ error: "The reservation could not be read." }, { status: 400 });

  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 160).toLowerCase();
  const phone = cleanText(body.phone, 40);
  const checkIn = cleanText(body.checkIn, 10);
  const checkOut = cleanText(body.checkOut, 10);
  const guests = Number(body.guests);
  const bookedVia = VIA.includes(String(body.bookedVia)) ? String(body.bookedVia) : "";
  const bookingRef = cleanText(body.bookingRef, 60);
  const note = cleanText(body.note, 600);
  const lines = parseLines(body.lines);

  if (name.length < 2) return NextResponse.json({ error: "Add your name." }, { status: 400 });
  if (!emailPattern.test(email)) return NextResponse.json({ error: "Add a valid email." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 6) return NextResponse.json({ error: "Add a phone number Frosina can reach you on." }, { status: 400 });
  if (!datePattern.test(checkIn) || !datePattern.test(checkOut) || checkOut <= checkIn) {
    return NextResponse.json({ error: "Add your check-in and check-out dates at Villa Kaja." }, { status: 400 });
  }
  if (!lines) return NextResponse.json({ error: "Check the equipment and ski school lines." }, { status: 400 });
  if (!lines.length) return NextResponse.json({ error: "Add at least one item of equipment or ski school." }, { status: 400 });

  const ref = `SR-${Date.now().toString(36).toUpperCase()}`;
  const { hosts } = await sendRentalReservation(
    {
      ref,
      name,
      email,
      phone,
      checkIn,
      checkOut,
      guests: Number.isInteger(guests) && guests > 0 && guests <= 30 ? guests : undefined,
      bookedVia: bookedVia || undefined,
      bookingRef: bookingRef || undefined,
      note: note || undefined,
      lines,
    },
    { guestCopy: true },
  );
  // Email is the only channel, so it must have gone out (local development without email excepted).
  const devWithoutEmail = hosts.error === "email not configured" && process.env.NODE_ENV !== "production";
  if (!hosts.sent && !devWithoutEmail) {
    return NextResponse.json({ error: "The reservation could not be sent right now. Please try again in a few minutes." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ref }, { headers: NO_STORE });
}
