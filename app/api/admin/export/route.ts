import { listBookings } from "@/lib/bookings";
import { listOptOuts } from "@/lib/booking-store";
import { dbConfigured } from "@/lib/db";
import { unsubscribeUrl } from "@/lib/marketing";
import { HOUSE_NAME, csv, guestList } from "@/lib/admin-data";
import { isHost } from "@/lib/host-auth";
import { NO_STORE, deny } from "@/lib/security";
import { paymentsEnabled } from "@/lib/stripe";
import { nightsBetween, todayAtHouses } from "@/lib/stay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV downloads for the admin: every booking, or one row per guest. Signed-in admins only. */
export async function GET(request: Request) {
  if (!(await isHost())) return deny("Please sign in again.", 401);
  if (!paymentsEnabled()) return deny("Stripe is not set up.", 503);
  const type = new URL(request.url).searchParams.get("type") === "guests" ? "guests" : "bookings";
  const bookings = await listBookings();
  const optOuts = dbConfigured() ? await listOptOuts().catch(() => new Map<string, string>()) : new Map<string, string>();
  const today = todayAtHouses();
  const body =
    type === "guests"
      ? csv([
          ["Name", "Email", "Phone", "Stays", "Nights", "Spent (EUR)", "Houses", "Last stay", "Next stay", "References", "OK to email offers", "Agreed on", "Unsubscribe link"],
          ...guestList(bookings, today, optOuts).map((g) => [
            g.name, g.email, g.phone, g.stays, g.nights, g.spent.toFixed(2), g.houses.map((h) => HOUSE_NAME[h]).join(" + "),
            g.lastStay ?? "", g.nextStay ?? "", g.refs.join(" "),
            g.offersOk ? "yes" : "no", g.offersOk ? (g.offersSince ?? "").slice(0, 10) : "", g.offersOk ? unsubscribeUrl(g.email) : "",
          ]),
        ])
      : csv([
          ["Reference", "House", "Status", "Check-in", "Check-out", "Nights", "Guests", "Name", "Email", "Phone", "Arrival", "Direct total (EUR)",
            "Airbnb total (EUR)", "Deposit (EUR)", "Balance (EUR)", "Balance received", "Booked at", "Stripe payment"],
          ...bookings.map((b) => [
            b.ref, HOUSE_NAME[b.property], b.status, b.checkIn, b.checkOut, nightsBetween(b.checkIn, b.checkOut), b.guests, b.name, b.email, b.phone,
            b.arrival, b.directTotal.toFixed(2), b.airbnbTotal === null ? "" : b.airbnbTotal.toFixed(2), b.deposit.toFixed(2), b.balance.toFixed(2),
            b.balancePaid ? "yes" : "no", b.createdAt, b.paymentIntentId,
          ]),
        ]);
  return new Response(body, {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sea-and-ski-${type}-${today}.csv"`,
    },
  });
}
