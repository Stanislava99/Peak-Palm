import { bookingFromIntent } from "@/lib/bookings";
import { sendEmail } from "@/lib/email";
import { adminNewReview } from "@/lib/email-templates";
import { REVIEW_TEXT_MAX, REVIEW_TEXT_MIN, readReviewToken, reviewFromIntent, reviewMetadata } from "@/lib/guest-reviews";
import { cleanText, guard } from "@/lib/security";
import { isTestSite, notifyEmails } from "@/lib/site-config";
import { sendOnce } from "@/lib/send-once";
import { findIntent, paymentsEnabled } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { addReview, getBookingByIntent, hasReview, importIntent } from "@/lib/booking-store";

export const runtime = "nodejs";

/** A guest submits the review for their own stay, using the signed link from the email. */
export async function POST(request: Request) {
  const blocked = await guard(request, "review", [[6, 10 * 60_000], [20, 24 * 3600_000]]);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 400 });
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ error: "Not sent." }, { status: 400 });

  const id = readReviewToken(body.t);
  if (!id || !paymentsEnabled()) return NextResponse.json({ error: "This review link has expired. Reply to our email for a new one." }, { status: 403 });

  const rating = Number(body.rating);
  const text = cleanText(body.text, REVIEW_TEXT_MAX).replace(/\n{3,}/g, "\n\n");
  const name = cleanText(body.name, 40).replace(/\s+/g, " ");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Choose a star rating." }, { status: 400 });
  if (text.length < REVIEW_TEXT_MIN) return NextResponse.json({ error: `Write at least ${REVIEW_TEXT_MIN} characters.` }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Add the name to show with your review." }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "Please agree to the review being published." }, { status: 400 });

  const found = await findIntent(id);
  if (!found) return NextResponse.json({ error: "We couldn’t find a completed stay for this link." }, { status: 404 });
  const { stripe, intent } = found;
  const booking = bookingFromIntent(intent);
  if (!booking || booking.status !== "confirmed") return NextResponse.json({ error: "We couldn’t find a completed stay for this link." }, { status: 404 });
  const useDb = dbConfigured();
  if (useDb && !(await getBookingByIntent(intent.id))) await importIntent(intent);
  if (useDb ? await hasReview(booking.ref) : reviewFromIntent(intent)) return NextResponse.json({ error: "We’ve already received your review for this stay. Thank you!" }, { status: 409 });
  const today = new Date().toISOString().slice(0, 10);
  if (!isTestSite() && booking.checkIn > today) {
    return NextResponse.json({ error: "You can review your stay once it has started." }, { status: 409 });
  }

  if (useDb) {
    // Stored once even if the form is sent twice at the same moment (primary key on the booking).
    if (!(await addReview(booking.ref, booking.property, { name, rating, text }))) {
      return NextResponse.json({ error: "We’ve already received your review for this stay. Thank you!" }, { status: 409 });
    }
    await stripe.paymentIntents.update(intent.id, { metadata: reviewMetadata({ name, rating, text }) }).catch(() => {});
    await sendEmail({ to: notifyEmails(), replyTo: booking.email, ...adminNewReview(booking, { name, rating, text }) });
    return NextResponse.json({ ok: true });
  }
  // Stored once even if the form is sent twice at the same moment (double tap).
  await sendOnce(stripe, intent.id, "reviewReceived", async () => {
    await stripe.paymentIntents.update(intent.id, { metadata: reviewMetadata({ name, rating, text }) });
    await sendEmail({ to: notifyEmails(), replyTo: booking.email, ...adminNewReview(booking, { name, rating, text }) });
    return true;
  });
  return NextResponse.json({ ok: true });
}
