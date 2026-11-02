import { DEPOSIT_LABEL, HOST_REPLY, splitPayment } from "@/lib/booking-config";
import { bookingMetadata, forgetBookedNights, newRef } from "@/lib/bookings";
import { fetchStayQuote } from "@/lib/pricing";
import { getProperty, isPropertyId, type PropertyId } from "@/lib/properties";
import { calendarWithSources } from "@/lib/reservations";
import { evaluateStay, formatLong } from "@/lib/stay";
import { getStripe, usingMockStripe } from "@/lib/stripe";
import { NO_STORE, cleanText, guard } from "@/lib/security";
import { NextResponse } from "next/server";

type Payload = {
  property?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  name?: string;
  email?: string;
  phone?: string;
  arrival?: string;
  note?: string;
  accepted?: boolean;
  /** Honeypot: hidden field real guests never fill in. */
  website?: string;
};

/** Below this the price is treated as a reading error, never charged. */
const MIN_NIGHTLY: Record<PropertyId, number> = { kaja: 60, janis: 40 };

const HOUSE_NAMES: Record<PropertyId, string> = { kaja: "Villa Kaja", janis: "Jani’s Beach House" };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // Card-testing bots hammer checkout endpoints: few attempts per address, and same-site only.
  const blocked = guard(request, "checkout", [
    [6, 10 * 60_000],
    [20, 24 * 3600_000],
  ]);
  if (blocked) return blocked;
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Online payment is not switched on yet." }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body) return NextResponse.json({ error: "The booking could not be read." }, { status: 400 });
  if (body.website) return NextResponse.json({ error: "The booking could not be read." }, { status: 400 });

  const property: PropertyId = isPropertyId(body.property) ? body.property : "kaja";
  const house = getProperty(property);
  const checkIn = body.checkIn ?? "";
  const checkOut = body.checkOut ?? "";
  const guests = Number(body.guests);
  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 160).toLowerCase();
  const phone = cleanText(body.phone, 40);
  const arrival = cleanText(body.arrival, 40);
  const note = cleanText(body.note, 480);

  if (!datePattern.test(checkIn) || !datePattern.test(checkOut)) {
    return NextResponse.json({ error: "Choose your dates again." }, { status: 400 });
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > house.maxGuests) {
    return NextResponse.json({ error: `Guests must be between 1 and ${house.maxGuests}.` }, { status: 400 });
  }
  if (name.length < 2) return NextResponse.json({ error: "Add the name for the booking." }, { status: 400 });
  if (!emailPattern.test(email)) return NextResponse.json({ error: "Add a valid email." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 6) {
    return NextResponse.json({ error: "Add a phone number the host can reach you on." }, { status: 400 });
  }
  if (!body.accepted) {
    return NextResponse.json({ error: "Please accept the house rules and cancellation policy." }, { status: 400 });
  }

  forgetBookedNights(property);
  const { days } = await calendarWithSources(property).catch(() => ({ days: [] }));
  const verdict = evaluateStay(days, checkIn, checkOut);
  if (!verdict.ok) return NextResponse.json({ error: verdict.message }, { status: 409 });

  const priced = await fetchStayQuote(property, checkIn, checkOut, guests);
  if (!priced.ok) {
    return NextResponse.json(
      { error: "We couldn’t confirm today’s price for these dates. Please try again in a minute." },
      { status: 503 },
    );
  }
  const quote = priced.quote;
  if (quote.perNight < MIN_NIGHTLY[property] || quote.nights !== evaluateStay(days, checkIn, checkOut).nights) {
    console.error("Checkout refused: implausible price", { property, checkIn, checkOut, perNight: quote.perNight });
    return NextResponse.json(
      { error: "We couldn’t confirm today’s price for these dates. Please try again later or ask the host." },
      { status: 503 },
    );
  }
  const { deposit, balance } = splitPayment(quote.directTotal);
  const ref = newRef(house.reservePrefix);
  const metadata = bookingMetadata({
    ref,
    property,
    checkIn,
    checkOut,
    guests,
    name,
    email,
    phone,
    arrival,
    note,
    airbnbTotal: quote.airbnbTotal,
    directTotal: quote.directTotal,
    deposit,
    balance,
  });

  const origin = new URL(request.headers.get("origin")!).origin;
  const back = new URLSearchParams({ property, checkIn, checkOut, guests: String(guests) });
  const stayLine = `${formatLong(checkIn)} – ${formatLong(checkOut)} · ${quote.nights} night${quote.nights === 1 ? "" : "s"} · ${guests} guest${guests === 1 ? "" : "s"}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_creation: "always",
      customer_email: email,
      locale: "en",
      client_reference_id: ref,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: deposit * 100,
            product_data: {
              name: `${HOUSE_NAMES[property]} · ${DEPOSIT_LABEL} deposit`,
              description: `${stayLine}. Deposit for your direct booking.`,
            },
          },
        },
      ],
      payment_method_types: ["card"],
      payment_method_options: { card: { request_three_d_secure: "any" } },
      payment_intent_data: {
        setup_future_usage: "off_session",
        description: `${ref} · ${HOUSE_NAMES[property]} · ${checkIn} → ${checkOut}`,
        metadata,
      },
      metadata,
      custom_text: {
        submit: {
          message: `You pay the 50% deposit now. The host confirms your booking ${HOST_REPLY}; if the dates can’t be confirmed, the deposit is refunded in full.`,
        },
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?${back}`,
    });
    if (!session.url?.startsWith("https://checkout.stripe.com/") && !usingMockStripe()) {
      return NextResponse.json({ error: "The payment page could not be opened." }, { status: 502 });
    }
    return NextResponse.json({ url: session.url, ref }, { headers: NO_STORE });
  } catch (error) {
    console.error("Stripe checkout failed", error);
    return NextResponse.json({ error: "The payment page could not be opened. Please try again." }, { status: 502 });
  }
}
