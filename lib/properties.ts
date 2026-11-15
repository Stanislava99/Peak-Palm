export type PropertyId = "kaja" | "janis";

export type RatingFallback = {
  score: number;
  count: number;
  categories: {
    cleanliness: number;
    accuracy: number;
    checkin: number;
    communication: number;
    location: number;
    value: number;
  };
  live: boolean;
};

export type Property = {
  id: PropertyId;
  maxGuests: number;
  airbnbId: string;
  airbnbUrl: string;
  bookingUrl: string | null;
  bookingName: string | null;
  reservePrefix: string;
  ratingFallback: RatingFallback;
  bookingFallback: { scoreLabel: string; reviewCount: number } | null;
  /**
   * Official short-term rental registration, shown wherever the house is advertised (house page, footer).
   * Greece: AMA from the AADE Short-Term Rental Registry. Bulgaria: the municipal registration/category certificate.
   */
  registration: { label: string; number: string } | null;
};

const kajaRating: RatingFallback = {
  score: 4.94,
  count: 114,
  categories: {
    cleanliness: 4.96,
    accuracy: 4.96,
    checkin: 5,
    communication: 4.99,
    location: 4.95,
    value: 4.96,
  },
  live: false,
};

const janisRating: RatingFallback = {
  score: 4.93,
  count: 43,
  categories: {
    cleanliness: 4.95,
    accuracy: 4.91,
    checkin: 5,
    communication: 5,
    location: 4.84,
    value: 4.93,
  },
  live: false,
};

export const properties: Record<PropertyId, Property> = {
  kaja: {
    id: "kaja",
    maxGuests: 15,
    airbnbId: "1849518",
    airbnbUrl: "https://www.airbnb.com/rooms/1849518",
    bookingUrl: "https://www.booking.com/hotel/bg/villa-kaja-bansko-bansko.en-gb.html",
    bookingName: "Villa Kaja",
    reservePrefix: "VK",
    ratingFallback: kajaRating,
    bookingFallback: { scoreLabel: "Exceptional", reviewCount: 16 },
    registration: { label: "Reg. No.", number: "Б3-02А-0СТ-С0" },
  },
  janis: {
    id: "janis",
    maxGuests: 9,
    airbnbId: "26322352",
    airbnbUrl: "https://www.airbnb.com/rooms/26322352",
    bookingUrl: null,
    bookingName: null,
    reservePrefix: "JB",
    ratingFallback: janisRating,
    bookingFallback: null,
    registration: { label: "AMA", number: "00000661253" },
  },
};

export function isPropertyId(value: string | null | undefined): value is PropertyId {
  return value === "kaja" || value === "janis";
}

export function getProperty(id: PropertyId) {
  return properties[id];
}

export function stayLink(
  base: string,
  checkIn: string,
  checkOut: string,
  guests: number,
  platform: "airbnb" | "booking",
) {
  const url = new URL(base);
  if (platform === "airbnb") {
    url.searchParams.set("check_in", checkIn);
    url.searchParams.set("check_out", checkOut);
    url.searchParams.set("adults", String(guests));
  } else {
    url.searchParams.set("checkin", checkIn);
    url.searchParams.set("checkout", checkOut);
    url.searchParams.set("group_adults", String(guests));
    url.searchParams.set("no_rooms", "1");
    url.searchParams.set("group_children", "0");
  }
  return url.toString();
}
