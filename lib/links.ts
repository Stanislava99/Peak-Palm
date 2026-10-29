export const AIRBNB_ID = "1849518";
export const AIRBNB_URL = `https://www.airbnb.com/rooms/${AIRBNB_ID}`;
export const BOOKING_URL = "https://www.booking.com/hotel/bg/villa-kaja-bansko-bansko.en-gb.html";

export function airbnbStayUrl(checkIn: string, checkOut: string, guests: number) {
  const url = new URL(AIRBNB_URL);
  url.searchParams.set("check_in", checkIn);
  url.searchParams.set("check_out", checkOut);
  url.searchParams.set("adults", String(guests));
  return url.toString();
}

export function bookingStayUrl(checkIn: string, checkOut: string, guests: number) {
  const url = new URL(BOOKING_URL);
  url.searchParams.set("checkin", checkIn);
  url.searchParams.set("checkout", checkOut);
  url.searchParams.set("group_adults", String(guests));
  url.searchParams.set("no_rooms", "1");
  url.searchParams.set("group_children", "0");
  return url.toString();
}
