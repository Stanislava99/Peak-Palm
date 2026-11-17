import {
  fetchAirbnbRating,
  fetchBookingListing,
  type BookingListing,
  type CalendarDay,
} from "@/lib/listings";
import { isPropertyId, type PropertyId } from "@/lib/properties";
import { calendarWithSources, type CalendarSources } from "@/lib/reservations";
import { NextResponse } from "next/server";

// Never cached: your admin blocks and direct bookings show on the next calendar load. (Airbnb/Booking.com: see channelCache.)
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("property");
  const property: PropertyId = isPropertyId(requested) ? requested : "kaja";
  let days: CalendarDay[] = [];
  let error: string | null = null;
  let booking: BookingListing | null;
  let sources: CalendarSources = { booking: "not-configured" };
  try {
    let calendar: { days: CalendarDay[]; sources: CalendarSources };
    [calendar, booking] = await Promise.all([calendarWithSources(property, "minute"), fetchBookingListing(property)]);
    days = calendar.days;
    sources = calendar.sources;
  } catch {
    error = "Airbnb’s calendar did not respond. Open the listing to check those dates.";
    booking = await fetchBookingListing(property);
  }
  const rating = await fetchAirbnbRating(property);
  return NextResponse.json(
    { days, error, booking, rating, sources },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
