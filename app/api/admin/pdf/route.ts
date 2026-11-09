import { bookingFromIntent } from "@/lib/bookings";
import { listSiteIntents } from "@/lib/stripe-records";
import { isHost } from "@/lib/host-auth";
import { confirmationPdf } from "@/lib/pdf/confirmation";
import { NO_STORE, deny } from "@/lib/security";
import { findIntent, paymentsEnabled } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isHost())) return deny("Please sign in again.", 401);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const found = id.startsWith("pi_") && paymentsEnabled() ? await findIntent(id) : null;
  if (!found) return deny("Unknown booking.", 400);
  const { stripe, intent } = found;
  const booking = bookingFromIntent(intent);
  if (!booking || booking.status !== "confirmed") return deny("Only confirmed bookings have a PDF.", 404);
  let paid = booking.balancePaid;
  if (!paid) {
    const balances = await listSiteIntents("balance", stripe);
    paid = balances.some((b) => b.metadata.depositIntent === intent.id && b.status === "succeeded");
  }
  const pdf = await confirmationPdf({ ...booking, balancePaid: paid }, paid ? "paid" : "deposit-paid");
  return new Response(new Uint8Array(pdf), {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Sea-and-Ski-${booking.ref}.pdf"`,
    },
  });
}
