import {
  fetchAirbnbRating,
  fetchBookingListing,
  type BookingListing,
  type CalendarDay,
} from "@/lib/listings";
import { isPropertyId, type PropertyId } from "@/lib/properties";
import { calendarWithHolds } from "@/lib/reservations";
import { NextResponse } from "next/server";

export const revalidate = 1800;

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("property");
  const property: PropertyId = isPropertyId(requested) ? requested : "kaja";
  let days: CalendarDay[] = [];
  let error: string | null = null;
  let booking: BookingListing | null;
  try {
    [days, booking] = await Promise.all([calendarWithHolds(property), fetchBookingListing(property)]);
  } catch {
    error = "Airbnb’s calendar did not respond. Open the listing to check those dates.";
    booking = await fetchBookingListing(property);
  }
  const rating = await fetchAirbnbRating(property);
  return NextResponse.json({ days, error, booking, rating });
}
