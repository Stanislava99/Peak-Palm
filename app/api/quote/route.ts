import { fetchStayQuote } from "@/lib/pricing";
import { getProperty, isPropertyId, type PropertyId } from "@/lib/properties";
import { clientIp, deny, rateLimit } from "@/lib/security";
import { NextResponse } from "next/server";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  if (!rateLimit(`quote:${clientIp(request)}`, 40, 10 * 60_000)) {
    return deny("Too many price checks. Please wait a few minutes.", 429);
  }
  const params = new URL(request.url).searchParams;
  const requested = params.get("property");
  const property: PropertyId = isPropertyId(requested) ? requested : "kaja";
  const checkIn = params.get("checkIn") ?? "";
  const checkOut = params.get("checkOut") ?? "";
  const guests = Math.max(1, Math.min(getProperty(property).maxGuests, Number(params.get("guests")) || 1));

  if (!datePattern.test(checkIn) || !datePattern.test(checkOut) || checkOut <= checkIn) {
    return NextResponse.json({ ok: false, reason: "no-price", message: "Choose a check-in and a later check-out." }, { status: 400 });
  }

  const result = await fetchStayQuote(property, checkIn, checkOut, guests);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
  });
}
