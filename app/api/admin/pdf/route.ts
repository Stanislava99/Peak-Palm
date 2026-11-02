import { SITE_TAG, bookingFromIntent } from "@/lib/bookings";
import { isHost } from "@/lib/host-auth";
import { confirmationPdf } from "@/lib/pdf/confirmation";
import { NO_STORE, deny } from "@/lib/security";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isHost())) return deny("Please sign in again.", 401);
  const stripe = getStripe();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!stripe || !id.startsWith("pi_")) return deny("Unknown booking.", 400);
  const intent = await stripe.paymentIntents.retrieve(id);
  const booking = bookingFromIntent(intent);
  if (!booking || booking.status !== "confirmed") return deny("Only confirmed bookings have a PDF.", 404);
  let paid = booking.balancePaid;
  if (!paid) {
    const balance = await stripe.paymentIntents.search({
      query: `metadata['site']:'${SITE_TAG}' AND metadata['kind']:'balance' AND metadata['depositIntent']:'${intent.id}' AND status:'succeeded'`,
      limit: 1,
    });
    paid = balance.data.length > 0;
  }
  const pdf = await confirmationPdf({ ...booking, balancePaid: paid }, paid ? "paid" : "deposit-paid");
  return new Response(new Uint8Array(pdf), {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Peak-and-Palm-${booking.ref}.pdf"`,
    },
  });
}
