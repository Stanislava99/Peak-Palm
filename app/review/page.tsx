import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ReviewForm } from "@/components/ReviewForm";
import { bookingFromIntent } from "@/lib/bookings";
import { brand } from "@/lib/brand";
import { readReviewToken, reviewFromIntent } from "@/lib/guest-reviews";
import { formatLong } from "@/lib/stay";
import { findIntent, paymentsEnabled } from "@/lib/stripe";
import type { Metadata } from "next";
import { dbConfigured } from "@/lib/db";
import { hasReview } from "@/lib/booking-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review your stay", robots: { index: false, follow: false } };

const NAMES = { kaja: "Villa Kaja", janis: "Jani’s Beach House" } as const;

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="success-card">
      <h1>{title}</h1>
      <p className="success-lede">{text}</p>
      <a className="button primary" href="/">
        Back to {brand.short}
      </a>
    </div>
  );
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ t?: string; r?: string }> }) {
  const { t, r } = await searchParams;
  const id = readReviewToken(t);
  const stripe = paymentsEnabled();
  let content: React.ReactNode;

  if (!id || !stripe) {
    content = <Message title="This link doesn’t work" text="The review link is incomplete or has expired. Reply to our email and we’ll send you a new one." />;
  } else {
    let booking = null;
    let already = false;
    try {
      const found = await findIntent(id);
      if (!found) throw new Error("not found");
      const intent = found.intent;
      booking = bookingFromIntent(intent);
      already = Boolean(reviewFromIntent(intent));
      if (!already && booking && dbConfigured()) already = await hasReview(booking.ref);
    } catch {
      booking = null;
    }
    if (!booking || booking.status !== "confirmed") {
      content = <Message title="This link doesn’t work" text="We couldn’t find a completed stay for this link. Reply to our email and we’ll help." />;
    } else if (already) {
      content = <Message title="Thank you!" text="We’ve already received your review for this stay. Thank you for taking the time." />;
    } else {
      const rating = Math.max(0, Math.min(5, Number(r) || 0));
      content = (
        <div className="review-page">
          <p className="eyebrow">Your stay · {booking.ref}</p>
          <h1>How was {NAMES[booking.property]}?</h1>
          <p className="success-lede">
            {formatLong(booking.checkIn)} → {formatLong(booking.checkOut)}. Thank you for staying with us,{" "}
            {booking.name.split(" ")[0]}. Your review helps other guests who book directly.
          </p>
          <ReviewForm token={t!} initialRating={rating} defaultName={booking.name.split(" ")[0]} />
        </div>
      );
    }
  }

  return (
    <div className="checkout-page">
      <Header sections={false} />
      <main className="checkout" id="top">
        {content}
      </main>
      <Footer />
    </div>
  );
}
