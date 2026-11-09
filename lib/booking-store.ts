import type { PoolClient } from "pg";
import type Stripe from "stripe";
import type { Booking, BookingStatus } from "./bookings";
import { bookingFromIntent } from "./bookings";
import { q, tx } from "./db";
import type { PropertyId } from "./properties";
import { isTestSite } from "./site-config";
import { eachNight } from "./stay";
import { listSiteIntents } from "./stripe-records";
import { stripeAccounts } from "./stripe";

/** A Stripe Checkout page stays open 30 minutes; the dates are held a little longer than that. */
export const HOLD_MINUTES = 32;

type Row = {
  ref: string;
  property: PropertyId;
  check_in: string;
  check_out: string;
  guests: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  arrival: string;
  note: string;
  airbnb_total: string | null;
  direct_total: string;
  deposit: string;
  balance: string;
  status: string;
  stripe_house: PropertyId;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  hold_until: Date | null;
  deposit_paid_at: Date | null;
  confirmed_at: Date | null;
  confirmed_by: string | null;
  declined_at: Date | null;
  balance_cash_at: Date | null;
  balance_cash_by: string | null;
  review_requested_at: Date | null;
  created_at: Date;
  review_status?: string | null;
  email_hosts?: Date | null;
  email_guest?: Date | null;
  email_confirmed?: Date | null;
  email_declined?: Date | null;
  marketing_opt_in_at?: Date | null;
};

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : undefined);
const day = (d: string | Date) => (typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10));

/** Shown status (the admin page vocabulary). */
function shownStatus(status: string): BookingStatus {
  if (status === "pending" || status === "confirmed" || status === "declined") return status;
  if (status === "expired" || status === "cancelled") return "expired";
  return "unpaid";
}

const SELECT = `
  select b.*,
    to_char(b.check_in, 'YYYY-MM-DD') as check_in,
    to_char(b.check_out, 'YYYY-MM-DD') as check_out,
    r.status as review_status,
    (select sent_at from emails e where e.ref = b.ref and e.kind = 'hosts_new' and e.status = 'sent') as email_hosts,
    (select sent_at from emails e where e.ref = b.ref and e.kind = 'guest_pending' and e.status = 'sent') as email_guest,
    (select sent_at from emails e where e.ref = b.ref and e.kind = 'confirmed' and e.status = 'sent') as email_confirmed,
    (select sent_at from emails e where e.ref = b.ref and e.kind = 'declined' and e.status = 'sent') as email_declined
  from bookings b left join reviews r on r.ref = b.ref`;

export function rowToBooking(r: Row): Booking {
  return {
    ref: r.ref,
    paymentIntentId: r.stripe_payment_intent ?? "",
    property: r.property,
    checkIn: day(r.check_in),
    checkOut: day(r.check_out),
    guests: r.guests,
    name: r.guest_name,
    email: r.guest_email,
    phone: r.guest_phone,
    arrival: r.arrival,
    note: r.note,
    airbnbTotal: r.airbnb_total === null ? null : Number(r.airbnb_total),
    directTotal: Number(r.direct_total),
    deposit: Number(r.deposit),
    balance: Number(r.balance),
    balancePaid: Boolean(r.balance_cash_at),
    status: shownStatus(r.status),
    createdAt: iso(r.deposit_paid_at ?? r.created_at)!,
    holdExpiresAt: iso(r.hold_until) ?? iso(r.created_at)!,
    reviewRequestedAt: iso(r.review_requested_at),
    reviewStatus: r.review_status ?? undefined,
    emails: {
      hosts: iso(r.email_hosts),
      guest: iso(r.email_guest),
      confirmed: iso(r.email_confirmed),
      declined: iso(r.email_declined),
    },
    stripeHouse: r.stripe_house,
    rawStatus: r.status,
    confirmedBy: r.confirmed_by ?? undefined,
    balanceCashBy: r.balance_cash_by ?? undefined,
    marketingOptInAt: iso(r.marketing_opt_in_at),
  };
}

export async function logEvent(ref: string, actor: string, type: string, detail?: unknown, client?: PoolClient) {
  const sql = "insert into booking_events (ref, actor, type, detail) values ($1, $2, $3, $4)";
  const params = [ref, actor, type, detail === undefined ? null : JSON.stringify(detail)];
  if (client) await client.query(sql, params);
  else await q(sql, params).catch((e) => console.warn("event log failed", e.message));
}

/* ── Reading ───────────────────────────────────────────── */

/** Paid bookings (waiting, confirmed, declined), newest first. */
export async function listBookingsDb(property?: PropertyId): Promise<Booking[]> {
  const rows = await q<Row>(
    `${SELECT} where b.status in ('pending','confirmed','declined','cancelled') ${property ? "and b.property = $1" : ""}
     order by coalesce(b.deposit_paid_at, b.created_at) desc limit 2000`,
    property ? [property] : [],
  );
  return rows.map(rowToBooking);
}

export async function getBookingByIntent(intentId: string): Promise<Booking | null> {
  const rows = await q<Row>(`${SELECT} where b.stripe_payment_intent = $1`, [intentId]);
  return rows[0] ? rowToBooking(rows[0]) : null;
}

export async function getBookingByRef(ref: string): Promise<Booking | null> {
  const rows = await q<Row>(`${SELECT} where b.ref = $1`, [ref]);
  return rows[0] ? rowToBooking(rows[0]) : null;
}

export async function bookingEvents(ref: string) {
  return q<{ at: Date; actor: string; type: string }>("select at, actor, type from booking_events where ref = $1 order by at", [ref]);
}

/**
 * Nights taken by paid direct bookings (waiting or confirmed). Guests who are paying right now
 * are not shown as taken on the calendar; createHold() stops anyone else paying for those nights.
 */
export async function blockedNightsDb(property: PropertyId): Promise<Set<string>> {
  const rows = await q<{ check_in: string; check_out: string }>(
    `select to_char(check_in, 'YYYY-MM-DD') as check_in, to_char(check_out, 'YYYY-MM-DD') as check_out from bookings
     where property = $1 and check_out >= current_date and status in ('pending','confirmed')`,
    [property],
  );
  const nights = new Set<string>();
  for (const r of rows) for (const n of eachNight(r.check_in, r.check_out)) nights.add(n);
  return nights;
}

/** Everything the admin calendar draws for a date range. */
export async function calendarBookings(from: string, to: string) {
  const rows = await q<Row>(
    `${SELECT} where b.check_out > $1 and b.check_in < $2
       and (b.status in ('pending','confirmed') or (b.status = 'awaiting_payment' and b.hold_until > now()))
     order by b.check_in`,
    [from, to],
  );
  return rows.map(rowToBooking);
}

/* ── Writing ───────────────────────────────────────────── */

export type NewHold = {
  ref: string;
  property: PropertyId;
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  phone: string;
  arrival: string;
  note: string;
  airbnbTotal: number | null;
  directTotal: number;
  deposit: number;
  balance: number;
  /** The guest ticked the optional "send me offers" box. */
  marketing?: boolean;
};

/**
 * Holds the dates while the guest pays. On the live site this is atomic per house (a lock), so two
 * guests can't pay for the same nights: the second one is told the dates were just taken.
 * The same guest trying again replaces their own earlier hold. On the test site dates never block.
 */
export async function createHold(hold: NewHold): Promise<{ ok: true } | { ok: false; reason: string }> {
  return tx(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`hold:${hold.property}`]);
    await client.query(
      `update bookings set status = 'expired', updated_at = now()
       where property = $1 and status = 'awaiting_payment' and lower(guest_email) = lower($2)`,
      [hold.property, hold.email],
    );
    if (!isTestSite()) {
      const clash = await client.query(
        `select ref from bookings where property = $1 and check_in < $3 and check_out > $2
           and (status in ('pending','confirmed') or (status = 'awaiting_payment' and hold_until > now()))
         limit 1`,
        [hold.property, hold.checkIn, hold.checkOut],
      );
      if (clash.rowCount) return { ok: false as const, reason: "Someone has just booked or is paying for these dates. Please choose other dates." };
    }
    await client.query(
      `insert into bookings (ref, property, check_in, check_out, guests, guest_name, guest_email, guest_phone, arrival, note,
         airbnb_total, direct_total, deposit, balance, status, stripe_house, hold_until, marketing_opt_in_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'awaiting_payment',$2, now() + make_interval(mins => $15),
         case when $16::boolean then now() end)`,
      [hold.ref, hold.property, hold.checkIn, hold.checkOut, hold.guests, hold.name, hold.email, hold.phone, hold.arrival, hold.note,
        hold.airbnbTotal, hold.directTotal, hold.deposit, hold.balance, HOLD_MINUTES, Boolean(hold.marketing)],
    );
    await logEvent(hold.ref, `guest:${hold.email}`, "checkout_started", { checkIn: hold.checkIn, checkOut: hold.checkOut, guests: hold.guests }, client);
    return { ok: true as const };
  });
}

export async function attachSession(ref: string, sessionId: string) {
  await q("update bookings set stripe_session_id = $2, updated_at = now() where ref = $1", [ref, sessionId]);
}

export async function releaseHold(ref: string) {
  await q("update bookings set status = 'expired', updated_at = now() where ref = $1 and status = 'awaiting_payment'", [ref]);
}

/**
 * The deposit is paid: the booking now waits for the host. Works even if the hold had expired
 * (the guest did pay). Creates the row from Stripe if the site never saw the checkout (older bookings).
 */
export async function markPaid(intent: Stripe.PaymentIntent, stripeHouse?: PropertyId): Promise<Booking | null> {
  const ref = intent.metadata?.ref;
  if (!ref) return null;
  const exists = await q("select 1 from bookings where ref = $1", [ref]);
  if (!exists.length) await importIntent(intent, stripeHouse);
  const changed = await q(
    `update bookings set status = 'pending', stripe_payment_intent = $2, deposit_paid_at = coalesce(deposit_paid_at, now()), hold_until = null, updated_at = now()
     where ref = $1 and status in ('awaiting_payment','expired','payment_failed') returning ref`,
    [ref, intent.id],
  );
  if (changed.length) await logEvent(ref, "stripe", "deposit_paid", { amount: intent.amount / 100, intent: intent.id });
  else await q("update bookings set stripe_payment_intent = coalesce(stripe_payment_intent, $2) where ref = $1", [ref, intent.id]);
  return getBookingByRef(ref);
}

export async function setStatus(ref: string, status: "confirmed" | "declined", by: string, extra: { refundId?: string } = {}) {
  if (status === "confirmed") {
    await q("update bookings set status = 'confirmed', confirmed_at = now(), confirmed_by = $2, updated_at = now() where ref = $1", [ref, by]);
  } else {
    await q(
      "update bookings set status = 'declined', declined_at = now(), declined_by = $2, refund_id = coalesce($3, refund_id), refunded_at = case when $3::text is null then refunded_at else now() end, updated_at = now() where ref = $1",
      [ref, by, extra.refundId ?? null],
    );
  }
  await logEvent(ref, by, status === "confirmed" ? "confirmed" : "declined_refunded", extra);
}

/** Moves a booking from "waiting" to a decision exactly once (two admins clicking at the same moment). */
export async function claimDecision(ref: string, to: "confirmed" | "declined"): Promise<boolean> {
  const rows = await q("update bookings set status = $2, updated_at = now() where ref = $1 and status = 'pending' returning ref", [ref, to]);
  return rows.length === 1;
}

export async function undoDecision(ref: string) {
  await q("update bookings set status = 'pending', updated_at = now() where ref = $1", [ref]);
}

export async function setCash(ref: string, by: string | null) {
  await q("update bookings set balance_cash_at = case when $2::text is null then null else now() end, balance_cash_by = $2, updated_at = now() where ref = $1", [ref, by]);
  await logEvent(ref, by ?? "admin", by ? "balance_cash_received" : "balance_cash_undone");
}

export async function setReviewRequested(ref: string) {
  await q("update bookings set review_requested_at = now(), updated_at = now() where ref = $1", [ref]);
  await logEvent(ref, "system", "review_requested");
}

/** Confirmed stays that ended 1–14 days ago and haven't been asked for a review yet. */
export async function bookingsDueForReview(): Promise<Booking[]> {
  const rows = await q<Row>(
    `${SELECT} where b.status = 'confirmed' and b.review_requested_at is null and r.ref is null
       and b.check_out < current_date and b.check_out >= current_date - 14 and b.guest_email <> ''`,
  );
  return rows.map(rowToBooking);
}

/* ── Emails: each kind once per booking ───────────────────── */

/**
 * Atomically claims the right to send one email (kind) for a booking. Exactly one caller wins,
 * even when two requests arrive at the same moment. A failed or stuck send can be retried;
 * `force` (the admin's "Resend emails") sends again regardless.
 */
export async function claimEmail(ref: string, kind: string, recipients: string, force = false): Promise<number | null> {
  const rows = await q<{ id: number }>(
    `insert into emails (ref, kind, recipients, status) values ($1, $2, $3, 'sending')
     on conflict (ref, kind) do update set status = 'sending', recipients = excluded.recipients, created_at = now(), error = null
       where $4 or emails.status = 'failed' or (emails.status = 'sending' and emails.created_at < now() - interval '2 minutes')
     returning id`,
    [ref, kind, recipients, force],
  );
  return rows[0]?.id ?? null;
}

export async function finishEmail(id: number, ok: boolean, error?: string) {
  await q("update emails set status = $2, error = $3, sent_at = case when $2 = 'sent' then now() else sent_at end where id = $1", [
    id,
    ok ? "sent" : "failed",
    error ?? null,
  ]);
}

export async function emailSent(ref: string, kind: string) {
  const rows = await q("select 1 from emails where ref = $1 and kind = $2 and status = 'sent'", [ref, kind]);
  return rows.length > 0;
}

/* ── Reviews and questions ─────────────────────────────── */

export type ReviewRow = {
  ref: string;
  property: PropertyId;
  name: string;
  rating: number;
  text: string;
  status: "pending" | "published" | "hidden";
  submitted_at: Date;
  check_in: string;
  payment_intent: string | null;
};

/** Stores a review once per stay. Returns false if one already exists. */
export async function addReview(ref: string, property: PropertyId, review: { name: string; rating: number; text: string }) {
  const rows = await q(
    `insert into reviews (ref, property, name, rating, text, status) values ($1,$2,$3,$4,$5,'pending') on conflict (ref) do nothing returning ref`,
    [ref, property, review.name, review.rating, review.text],
  );
  if (rows.length) await logEvent(ref, "guest", "review_received", { rating: review.rating });
  return rows.length === 1;
}

export async function hasReview(ref: string) {
  return (await q("select 1 from reviews where ref = $1", [ref])).length > 0;
}

export async function listReviews(options: { status?: string; property?: PropertyId } = {}): Promise<ReviewRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (options.status) where.push(`r.status = $${params.push(options.status)}`);
  if (options.property) where.push(`r.property = $${params.push(options.property)}`);
  return q<ReviewRow>(
    `select r.*, to_char(b.check_in, 'YYYY-MM-DD') as check_in, b.stripe_payment_intent as payment_intent
     from reviews r join bookings b on b.ref = r.ref ${where.length ? `where ${where.join(" and ")}` : ""}
     order by r.submitted_at desc`,
    params,
  );
}

export async function moderateReview(ref: string, status: "published" | "hidden", by: string) {
  const rows = await q("update reviews set status = $2, moderated_at = now(), moderated_by = $3 where ref = $1 returning ref", [ref, status, by]);
  if (rows.length) await logEvent(ref, by, `review_${status}`);
  return rows.length === 1;
}

export async function addQuestion(property: string | null, name: string, email: string, message: string) {
  await q("insert into questions (property, name, email, message) values ($1, $2, $3, $4)", [property, name, email, message]);
}

export type QuestionRow = { id: string; property: string | null; name: string; email: string; message: string; created_at: Date };

/** Questions sent from the house pages, newest first (for the admin inbox). */
export async function listQuestions(limit = 200): Promise<QuestionRow[]> {
  return q<QuestionRow>("select id::text as id, property, name, email, message, created_at from questions order by created_at desc limit $1", [limit]);
}

/** Email addresses that unsubscribed from offers (or were removed by a host), with when. */
export async function listOptOuts(): Promise<Map<string, string>> {
  const rows = await q<{ email: string; at: Date }>("select email, at from marketing_optouts");
  return new Map(rows.map((r) => [r.email, new Date(r.at).toISOString()]));
}

/** Stops offers to this address. A later booking where the guest ticks the box again restarts them. */
export async function withdrawMarketing(email: string, source: string) {
  const address = email.trim().toLowerCase();
  if (!address) return;
  await q(
    "insert into marketing_optouts (email, at, source) values ($1, now(), $2) on conflict (email) do update set at = now(), source = excluded.source",
    [address, source],
  );
}

/* ── Importing what Stripe already holds (bookings made before the database) ── */

function dbStatusFromStripe(intent: Stripe.PaymentIntent): string {
  const s = bookingFromIntent(intent)?.status;
  if (s === "pending" || s === "confirmed" || s === "declined") return s;
  if (s === "expired") return "expired";
  return "payment_failed";
}

export async function importIntent(intent: Stripe.PaymentIntent, stripeHouse?: PropertyId) {
  const b = bookingFromIntent(intent);
  if (!b) return false;
  const m = intent.metadata;
  const status = dbStatusFromStripe(intent);
  const inserted = await q(
    `insert into bookings (ref, property, check_in, check_out, guests, guest_name, guest_email, guest_phone, arrival, note,
       airbnb_total, direct_total, deposit, balance, status, stripe_house, stripe_payment_intent, deposit_paid_at,
       confirmed_at, declined_at, balance_cash_at, balance_cash_by, review_requested_at, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     on conflict (ref) do nothing returning ref`,
    [b.ref, b.property, b.checkIn, b.checkOut, b.guests || 1, b.name || "Guest", b.email, b.phone, b.arrival, b.note,
      b.airbnbTotal, b.directTotal, b.deposit, b.balance, status, stripeHouse ?? b.property, intent.id,
      intent.status === "succeeded" ? b.createdAt : null,
      m.confirmedAt || (status === "confirmed" ? b.createdAt : null), m.declinedAt || null,
      m.balanceCash ? m.balanceCash.split(" ")[0] : null, m.balanceCash ? m.balanceCash.split(" ").slice(1).join(" ") || "admin" : null,
      m.reviewRequestedAt || null, b.createdAt],
  );
  if (!inserted.length) return false;
  await logEvent(b.ref, "system", "imported_from_stripe", { intent: intent.id });
  const flags: Array<[string, string]> = [["mailedRequest", "hosts_new"], ["mailedGuestPending", "guest_pending"], ["mailedConfirmed", "confirmed"], ["mailedDeclined", "declined"]];
  for (const [flag, kind] of flags) {
    if (m[flag]) await q("insert into emails (ref, kind, status, sent_at) values ($1, $2, 'sent', $3) on conflict do nothing", [b.ref, kind, m[flag]]);
  }
  if (m.reviewStatus && m.reviewText1 !== undefined) {
    await q(
      `insert into reviews (ref, property, name, rating, text, status, submitted_at) values ($1,$2,$3,$4,$5,$6,coalesce($7::timestamptz, now())) on conflict do nothing`,
      [b.ref, b.property, m.reviewName || b.name.split(" ")[0] || "Guest", Math.max(1, Math.min(5, Number(m.reviewRating) || 5)),
        `${m.reviewText1 ?? ""}${m.reviewText2 ?? ""}${m.reviewText3 ?? ""}`, m.reviewStatus, m.reviewAt || null],
    );
  }
  return true;
}

/** One-time import of every booking already in Stripe (runs on the first admin visit, safe to repeat). */
export async function importFromStripeOnce(force = false) {
  if (!force) {
    const done = await q("select 1 from app_meta where key = 'stripe_import_v1'");
    if (done.length) return 0;
  }
  let count = 0;
  for (const intent of await listSiteIntents("deposit")) {
    if (await importIntent(intent).catch(() => false)) count += 1;
  }
  await q("insert into app_meta (key, value) values ('stripe_import_v1', $1) on conflict (key) do update set value = excluded.value, updated_at = now()", [String(count)]);
  return count;
}

/**
 * Safety net when Stripe's notification never arrives: checks bookings still "awaiting payment"
 * against their Checkout Session, and marks paid ones. Returns the bookings that became paid.
 */
export async function reconcileAwaiting(limit = 15): Promise<Array<{ booking: Booking; stripe: Stripe }>> {
  const rows = await q<{ ref: string; stripe_session_id: string; stripe_house: PropertyId }>(
    `select ref, stripe_session_id, stripe_house from bookings
     where status in ('awaiting_payment','expired') and stripe_session_id is not null
       and created_at < now() - interval '1 minute' and created_at > now() - interval '3 days'
     order by created_at desc limit $1`,
    [limit],
  );
  const paid: Array<{ booking: Booking; stripe: Stripe }> = [];
  const accounts = stripeAccounts();
  for (const row of rows) {
    const account = accounts.find((a) => a.houses.includes(row.stripe_house)) ?? accounts[0];
    if (!account) break;
    try {
      const session = await account.stripe.checkout.sessions.retrieve(row.stripe_session_id, { expand: ["payment_intent"] });
      const intent = session.payment_intent as Stripe.PaymentIntent | null;
      if (intent && typeof intent === "object" && intent.status === "succeeded" && session.payment_status !== "unpaid") {
        const booking = await markPaid(intent, row.stripe_house);
        if (booking) paid.push({ booking, stripe: account.stripe });
      } else if (session.status === "expired") {
        await releaseHold(row.ref);
      }
    } catch (error) {
      console.warn("Reconcile failed for", row.ref, (error as Error).message);
    }
  }
  return paid;
}
