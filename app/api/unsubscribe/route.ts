import { dbConfigured } from "@/lib/db";
import { withdrawMarketing } from "@/lib/booking-store";
import { readUnsubscribeToken } from "@/lib/marketing";
import { NO_STORE, guard } from "@/lib/security";
import { NextResponse } from "next/server";

/** A guest unsubscribes from offers with the signed link from an email. */
export async function POST(request: Request) {
  const blocked = await guard(request, "unsubscribe", [[20, 10 * 60_000]]);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => null)) as { t?: string } | null;
  const email = readUnsubscribeToken(body?.t);
  if (!email) return NextResponse.json({ error: "This unsubscribe link isn’t valid. Reply to the email instead and we’ll remove you." }, { status: 400 });
  if (!dbConfigured()) return NextResponse.json({ error: "Please reply to the email and we’ll remove you." }, { status: 503 });
  await withdrawMarketing(email, "guest");
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
