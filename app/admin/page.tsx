import { Header } from "@/components/Header";
import { HostActions, HostLogin, HostLogout } from "@/components/HostPanel";
import { SITE_TAG, listBookings, type Booking } from "@/lib/bookings";
import { emailConfigured } from "@/lib/email";
import { currentAdmin, hostSetupProblem, passwordLoginEnabled, totpRequired } from "@/lib/host-auth";
import { appEnv, notifyEmails } from "@/lib/site-config";
import { formatMoney } from "@/lib/pricing";
import { formatLong, nightsBetween } from "@/lib/stay";
import { getStripe, isTestMode, paymentsEnabled } from "@/lib/stripe";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Host", robots: { index: false, follow: false } };

const NAMES = { kaja: "Villa Kaja", janis: "Jani’s Beach House" } as const;

async function paidBalances(): Promise<Set<string>> {
  const stripe = getStripe();
  if (!stripe) return new Set();
  const result = await stripe.paymentIntents.search({
    query: `metadata['site']:'${SITE_TAG}' AND metadata['kind']:'balance' AND status:'succeeded'`,
    limit: 100,
  });
  return new Set(result.data.map((intent) => intent.metadata.ref).filter(Boolean));
}

function waitingDays(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days >= 1 ? ` (${days} day${days === 1 ? "" : "s"})` : "";
}

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
}

function BookingRow({ booking, paid }: { booking: Booking; paid: boolean }) {
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const dashboard = `https://dashboard.stripe.com/${isTestMode() ? "test/" : ""}payments/${booking.paymentIntentId}`;
  const balancePaid = booking.balancePaid || paid;
  return (
    <article className={`host-booking is-${booking.status}`}>
      <header>
        <div>
          <p className="eyebrow">
            {NAMES[booking.property]} · {booking.ref}
          </p>
          <h3>
            {formatLong(booking.checkIn)} → {formatLong(booking.checkOut)}
          </h3>
          <p className="host-meta">
            {nights} night{nights === 1 ? "" : "s"} · {booking.guests} guest{booking.guests === 1 ? "" : "s"} · booked{" "}
            {new Date(booking.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        </div>
        <span className={`host-status is-${booking.status}`}>
          {booking.status === "pending"
            ? `Deposit paid · waiting for you${waitingDays(booking.createdAt)}`
            : booking.status === "confirmed"
              ? balancePaid
                ? "Confirmed · fully paid"
                : "Confirmed · deposit paid"
              : booking.status === "declined"
                ? "Declined"
                : booking.status === "expired"
                  ? "Not completed"
                  : "Not paid"}
        </span>
      </header>
      <div className="host-grid">
        <dl>
          <dt>Guest</dt>
          <dd>{booking.name}</dd>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${booking.email}`}>{booking.email}</a>
          </dd>
          <dt>Phone</dt>
          <dd>
            <a href={`tel:${booking.phone}`}>{booking.phone}</a>
          </dd>
          <dt>Arrival</dt>
          <dd>{booking.arrival || "—"}</dd>
          {booking.note ? (
            <>
              <dt>Message</dt>
              <dd>{booking.note}</dd>
            </>
          ) : null}
        </dl>
        <dl>
          <dt>Direct price</dt>
          <dd>
            <b>{formatMoney(booking.directTotal)}</b>
            {booking.airbnbTotal ? <small> (Airbnb {formatMoney(booking.airbnbTotal)})</small> : null}
          </dd>
          <dt>Deposit</dt>
          <dd>
            {formatMoney(booking.deposit)} {booking.status === "declined" ? "refunded" : booking.status === "pending" || booking.status === "confirmed" ? "paid" : ""}
          </dd>
          <dt>Balance</dt>
          <dd>
            {formatMoney(booking.balance)} {balancePaid ? "paid" : booking.status === "confirmed" ? "to charge" : ""}
          </dd>
          <dt>Stripe</dt>
          <dd>
            <a href={dashboard} target="_blank" rel="noreferrer">
              Open payment
            </a>
          </dd>
          {booking.status === "confirmed" ? (
            <>
              <dt>Confirmation</dt>
              <dd>
                <a href={`/api/admin/pdf?id=${booking.paymentIntentId}`}>Download PDF</a>
              </dd>
            </>
          ) : null}
        </dl>
      </div>
      <HostActions id={booking.paymentIntentId} status={booking.status} balancePaid={balancePaid} />
    </article>
  );
}

export default async function HostPage() {
  const admin = await currentAdmin();
  if (!admin) {
    const problem = hostSetupProblem(emailConfigured());
    return (
      <div className="checkout-page">
        <Header sections={false} />
        <main className="checkout host" id="top">
          <div className="success-card">
            <p className="eyebrow">{appEnv() === "test" ? "Test site" : "Peak & Palm"}</p>
            <h1>Admin</h1>
            {problem ? (
              <p className="success-lede">{problem}</p>
            ) : (
              <HostLogin needsCode={totpRequired()} emailLogin={emailConfigured()} passwordLogin={passwordLoginEnabled()} />
            )}
          </div>
        </main>
      </div>
    );
  }

  let bookings: Booking[] = [];
  let paid = new Set<string>();
  let problem: string | null = null;
  if (!paymentsEnabled()) problem = "Stripe isn’t connected yet. Add STRIPE_SECRET_KEY to the environment settings.";
  else {
    try {
      [bookings, paid] = await Promise.all([listBookings(), paidBalances()]);
    } catch {
      problem = "Stripe didn’t respond. Try again in a moment.";
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings.filter((b) => b.status === "confirmed" && b.checkOut >= today).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const other = bookings.filter((b) => !pending.includes(b) && !upcoming.includes(b)).slice(0, 20);

  return (
    <div className="checkout-page">
      <Header sections={false} />
      <main className="checkout host" id="top">
        <div className="host-head">
          <div>
            <p className="eyebrow">
              Admin · {appEnv() === "test" ? "TEST site (Stripe test mode)" : "Live site"} · signed in as {admin}
            </p>
            <h1>Direct bookings</h1>
            <p>
              Guests pay the deposit at checkout. Confirm to send them their confirmation email and PDF; decline to refund the
              deposit in full. Paid dates are already blocked on the site. Block them on Airbnb and Booking.com when you confirm.
            </p>
            <p className="host-meta">
              Notifications go to {notifyEmails().join(", ")}
              {emailConfigured() ? "." : ". Email isn’t set up yet, so no emails are being sent."}
            </p>
          </div>
          <HostLogout />
        </div>
        {problem ? <p className="checkout-problem">{problem}</p> : null}
        <section className="host-section">
          <h2>Waiting for you ({pending.length})</h2>
          {pending.length ? pending.map((b) => <BookingRow key={b.paymentIntentId} booking={b} paid={paid.has(b.ref)} />) : <p className="host-empty">Nothing waiting.</p>}
        </section>
        <section className="host-section">
          <h2>Upcoming ({upcoming.length})</h2>
          {upcoming.length ? upcoming.map((b) => <BookingRow key={b.paymentIntentId} booking={b} paid={paid.has(b.ref)} />) : <p className="host-empty">No upcoming direct stays.</p>}
        </section>
        {other.length ? (
          <section className="host-section">
            <h2>Past, declined and expired</h2>
            {other.map((b) => (
              <BookingRow key={b.paymentIntentId} booking={b} paid={paid.has(b.ref)} />
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
