import { timingSafeEqual } from "crypto";
import { bookingsDueForReview } from "@/lib/guest-reviews";
import { sendReviewRequest } from "@/lib/review-requests";
import { paymentsEnabled, stripeOf } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { dbConfigured, tidyDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Runs once a day (vercel.json). Emails "How was your stay?" to guests whose confirmed stay
 * ended in the last 14 days and who haven't been asked yet.
 * Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (dbConfigured()) await tidyDb().catch((error) => console.warn("Database tidy-up failed", error.message));
  if (!paymentsEnabled()) return NextResponse.json({ ok: true, sent: 0, note: "Stripe not set up" });

  const due = await bookingsDueForReview();
  let sent = 0;
  const failed: string[] = [];
  for (const { intent, booking } of due) {
    const stripe = stripeOf(intent);
    if (!stripe) continue;
    const result = await sendReviewRequest(stripe, intent, booking);
    if (result.sent) sent += 1;
    else failed.push(booking.ref);
  }
  return NextResponse.json({ ok: true, due: due.length, sent, failed });
}
