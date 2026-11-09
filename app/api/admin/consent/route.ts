import { dbConfigured } from "@/lib/db";
import { logEvent, withdrawMarketing } from "@/lib/booking-store";
import { currentAdmin } from "@/lib/host-auth";
import { NO_STORE, guard } from "@/lib/security";
import { NextResponse } from "next/server";

/** A host stops offers to a guest (for example when the guest asked by reply). */
export async function POST(request: Request) {
  const blocked = await guard(request, "host-consent", [[60, 10 * 60_000]]);
  if (blocked) return blocked;
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  if (!dbConfigured()) return NextResponse.json({ error: "The database isn’t connected." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { email?: string; ref?: string } | null;
  const email = (body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Unknown guest." }, { status: 400 });
  await withdrawMarketing(email, `host:${admin}`);
  if (body?.ref) await logEvent(String(body.ref).slice(0, 40), admin, "offers_removed");
  return NextResponse.json({ ok: true, message: "Removed from offers." }, { headers: NO_STORE });
}
