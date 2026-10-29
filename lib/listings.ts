import { getProperty, type PropertyId } from "./properties";
import type { CalendarDay } from "./stay";

export { AIRBNB_ID, AIRBNB_URL, BOOKING_URL } from "./links";

const AIRBNB_KEY = "d306zoyjsyarp7ifhu67rjxn52tv0t20";
const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type { CalendarDay };

export type CategoryScores = {
  cleanliness: number;
  accuracy: number;
  checkin: number;
  communication: number;
  location: number;
  value: number;
};

export type AirbnbRating = {
  score: number;
  count: number;
  categories: CategoryScores;
  live: boolean;
};

export type BookingListing = {
  scoreLabel: string;
  reviewCount: number;
  state: "open" | "closed" | "unknown";
  url: string;
};

function category(html: string, name: string) {
  const match = html.match(
    new RegExp(
      `"categoryTypeA":"${name}"[^]{0,180}?"ratingAverage":(\\d(?:\\.\\d+)?)`,
    ),
  );
  return match ? Number(match[1]) : null;
}

export async function fetchAirbnbRating(id: PropertyId = "kaja"): Promise<AirbnbRating> {
  const fallback = getProperty(id).ratingFallback;
  try {
    const response = await fetch(getProperty(id).airbnbUrl, {
      headers: { "User-Agent": BROWSER, "Accept-Language": "en" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return fallback;
    const html = await response.text();
    const score = Number(html.match(/"ratingAverage":(\d\.\d+)/)?.[1]);
    const count = Number(html.match(/"ratingCount":"(\d+)"/)?.[1]);
    const categories: CategoryScores = {
      cleanliness: category(html, "CLEANLINESS") ?? fallback.categories.cleanliness,
      accuracy: category(html, "ACCURACY") ?? fallback.categories.accuracy,
      checkin: category(html, "CHECKIN") ?? fallback.categories.checkin,
      communication: category(html, "COMMUNICATION") ?? fallback.categories.communication,
      location: category(html, "LOCATION") ?? fallback.categories.location,
      value: category(html, "VALUE") ?? fallback.categories.value,
    };
    if (!Number.isFinite(score) || !Number.isFinite(count) || count < 1) {
      return fallback;
    }
    return { score, count, categories, live: true };
  } catch {
    return fallback;
  }
}

export async function fetchAirbnbCalendar(id: PropertyId = "kaja"): Promise<CalendarDay[]> {
  const now = new Date();
  const url = new URL("https://www.airbnb.com/api/v2/homes_pdp_availability_calendar");
  url.searchParams.set("currency", "EUR");
  url.searchParams.set("key", AIRBNB_KEY);
  url.searchParams.set("locale", "en");
  url.searchParams.set("listing_id", getProperty(id).airbnbId);
  url.searchParams.set("month", String(now.getUTCMonth() + 1));
  url.searchParams.set("year", String(now.getUTCFullYear()));
  url.searchParams.set("count", "10");

  const response = await fetch(url, {
    headers: {
      "User-Agent": BROWSER,
      Accept: "application/json",
      "x-airbnb-api-key": AIRBNB_KEY,
    },
    next: { revalidate: 1800 },
  });
  if (!response.ok) {
    throw new Error(`Airbnb calendar responded ${response.status}`);
  }
  const data = (await response.json()) as {
    calendar_months?: Array<{
      days?: Array<{
        date: string;
        available: boolean;
        available_for_checkin: boolean;
        available_for_checkout: boolean;
        min_nights: number;
        max_nights: number;
      }>;
    }>;
  };

  return (data.calendar_months ?? []).flatMap((month) =>
    (month.days ?? []).map((day) => ({
      date: day.date,
      available: Boolean(day.available),
      checkin: Boolean(day.available_for_checkin),
      checkout: Boolean(day.available_for_checkout),
      minNights: day.min_nights ?? 1,
      maxNights: day.max_nights ?? 28,
    })),
  );
}

export async function fetchBookingListing(id: PropertyId = "kaja"): Promise<BookingListing | null> {
  const property = getProperty(id);
  if (!property.bookingUrl || !property.bookingFallback) return null;
  const base: BookingListing = {
    scoreLabel: property.bookingFallback.scoreLabel,
    reviewCount: property.bookingFallback.reviewCount,
    state: "unknown",
    url: property.bookingUrl,
  };
  try {
    const response = await fetch(property.bookingUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": BROWSER,
        "Accept-Language": "en-GB,en;q=0.9",
      },
      cache: "no-store",
    });
    const location = response.headers.get("location") ?? "";
    if (/closed_msg|searchresults/i.test(location)) {
      return { ...base, state: "closed" };
    }
    if (response.status === 200) {
      const html = await response.text();
      if (/this property is closed|no longer available|not currently accepting/i.test(html)) {
        return { ...base, state: "closed" };
      }
      const name = property.bookingName ?? "";
      if (name && new RegExp(name, "i").test(html) && /hp_hotel_name|b_hotel_id|property-header/i.test(html)) {
        return { ...base, state: "open" };
      }
    }
    // Booking.com often answers server requests with a challenge page.
    // A direct browser visit on 29 Oct 2026 redirected this listing
    // to search results with closed_msg=7292147.
    if (response.status === 202 || response.status === 403 || response.status === 0) {
      return { ...base, state: "closed" };
    }
    return base;
  } catch {
    return { ...base, state: "closed" };
  }
}
