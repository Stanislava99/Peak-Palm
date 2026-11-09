import { Header } from "@/components/Header";
import { HostActions, HostLogin, HostLogout, ReviewActions } from "@/components/HostPanel";
import { DrawerKeys, FilterBox } from "@/components/AdminUI";
import { RemoveFromOffers } from "@/components/Unsubscribe";
import { unsubscribeUrl } from "@/lib/marketing";
import { Mark } from "@/components/Logo";
import { listDirectReviews, type DirectReview } from "@/lib/guest-reviews";
import { listBookings, type Booking } from "@/lib/bookings";
import { listSiteIntents } from "@/lib/stripe-records";
import { emailConfigured } from "@/lib/email";
import { currentAdmin, hostSetupProblem, passwordLoginEnabled, totpRequired } from "@/lib/host-auth";
import { appEnv, notifyEmails } from "@/lib/site-config";
import { formatMoney } from "@/lib/pricing";
import { formatDay, formatLong, nightsBetween, todayAtHouses } from "@/lib/stay";
import { isTestMode, paymentsEnabled, secretKeyFor } from "@/lib/stripe";
import { loadAirbnbReviews } from "@/lib/reviews";
import { getSiteUrl } from "@/lib/site";
import type { Metadata } from "next";
import { BookingCalendar, monthRange, parseMonth, parseSpan, type OtherChannels } from "@/components/BookingCalendar";
import { databaseEnvKey, dbConfigured } from "@/lib/db";
import { bookingEvents, calendarBookings, importFromStripeOnce, listOptOuts, listQuestions, reconcileAwaiting, type QuestionRow } from "@/lib/booking-store";
import { notifyDepositPaid } from "@/lib/booking-notify";
import { fetchAirbnbCalendar } from "@/lib/listings";
import { fetchBookingNights } from "@/lib/ical";
import type { PropertyId } from "@/lib/properties";
import {
  AIRBNB_HOST_FEE, HOUSES, HOUSE_NAME, addDays, guestList, isLive, monthlyRevenue, money, movements, revenueYears, type Guest, type MonthBar,
} from "@/lib/admin-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

type View = "today" | "calendar" | "bookings" | "guests" | "revenue" | "reviews" | "inbox" | "setup" | "more";
const VIEWS: View[] = ["today", "calendar", "bookings", "guests", "revenue", "reviews", "inbox", "setup", "more"];
type Params = { view?: string; m?: string; span?: string; b?: string; y?: string };

/* ── Small pieces ──────────────────────────────────────── */

const ICONS: Record<string, string> = {
  today: "M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20",
  calendar: "M4 6.5h16v13.5H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5",
  bookings: "M5 4h14v16H5zM8.5 8.5h7M8.5 12h7M8.5 15.5h4",
  guests: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.3a3.4 3.4 0 0 1 0 6.4M18 14.8c2 .6 3.2 2.3 3.5 5.2",
  revenue: "M4 20V10M10 20V4M16 20v-7M21 20H3",
  reviews: "m12 3.5 2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.5l1-5.8L3.5 9.6l5.9-.8z",
  inbox: "M3.5 13.5 6 5h12l2.5 8.5V19h-17zM3.5 13.5H9l1 2h4l1-2h5.5",
  setup: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2.1 1.2l-.3 2h-4l-.3-2a7 7 0 0 1-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3L2.4 9.3l2-3.4 1.9.7a7 7 0 0 1 2.1-1.2l.3-2h4l.3 2a7 7 0 0 1 2.1 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3Z",
  more: "M4 7h16M4 12h16M4 17h16",
  arrow: "M5 12h14M13 6l6 6-6 6",
  out: "M14 5h5v14h-5M10 8l-4 4 4 4M6 12h10",
};

function Icon({ name, size = 20 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg className="adm-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={ICONS[name] ?? ""} />
    </svg>
  );
}

const money0 = (n: number) => formatMoney(Math.round(n));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const clock = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" }) : null;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Guest";
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
const whatsapp = (phone: string) => {
  const digits = phone.replace(/[^\d]/g, "").replace(/^00/, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
};

function statusText(b: Booking) {
  if (b.status === "pending") return "Waiting for you";
  if (b.status === "confirmed") return b.balancePaid ? "Confirmed · paid" : "Confirmed · cash due";
  if (b.status === "declined") return "Declined · refunded";
  if (b.status === "expired") return "Not completed";
  return "Not paid";
}

function Pill({ b }: { b: Booking }) {
  const tone = b.status === "confirmed" ? (b.balancePaid ? "ok" : "info") : b.status === "pending" ? "warn" : "muted";
  return <span className={`adm-pill is-${tone}`}>{statusText(b)}</span>;
}

function waitingFor(iso: string) {
  const hours = Math.floor((Date.now() - Date.parse(iso)) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/* ── Data ──────────────────────────────────────────────── */

async function paidBalances(): Promise<Set<string>> {
  const balances = await listSiteIntents("balance");
  return new Set(balances.filter((intent) => intent.status === "succeeded").map((intent) => intent.metadata.ref).filter(Boolean));
}

/** Nights taken outside the site: Airbnb's calendar (bookings and your blocks) and Booking.com. */
async function otherChannelNights(): Promise<OtherChannels> {
  const one = async (house: PropertyId) => {
    const [airbnb, booking] = await Promise.all([
      fetchAirbnbCalendar(house).catch(() => []),
      fetchBookingNights(house).catch(() => ({ nights: new Set<string>() })),
    ]);
    return { airbnb: new Set(airbnb.filter((d) => !d.available).map((d) => d.date)), booking: booking.nights };
  };
  const [kaja, janis] = await Promise.all([one("kaja"), one("janis")]);
  return { kaja, janis };
}

/**
 * Database upkeep on each admin visit: copy in bookings made before the database existed (once),
 * and check payments Stripe never told us about (the guest paid, but the webhook didn't arrive):
 * those become "waiting for you" and their emails go out.
 */
async function databaseUpkeep(): Promise<string | null> {
  if (!dbConfigured()) return null;
  try {
    await importFromStripeOnce();
    const found = await reconcileAwaiting();
    for (const { booking, stripe } of found) await notifyDepositPaid(stripe, booking).catch(() => false);
    return null;
  } catch (error) {
    console.error("Database upkeep failed", (error as Error).message);
    return "The database didn’t respond, so this page may be incomplete. Try again in a moment.";
  }
}

/** Paid bookings Stripe never told the site about (no "new booking" email after 3 minutes). */
function silentWebhook(bookings: Booking[]) {
  return bookings.filter((b) => isLive(b) && !b.emails.hosts && Date.now() - Date.parse(b.createdAt) > 3 * 60_000);
}

/** Which Stripe account each house is paid into (never shows the keys themselves). */
function stripeSetup() {
  return HOUSES.map((house) => {
    const key = secretKeyFor(house.id);
    if (!key) return { house: house.name, text: "No Stripe key", ok: false };
    const own = Boolean(process.env[`STRIPE_SECRET_KEY_${house.id.toUpperCase()}`]?.trim());
    const mode = /_live_/.test(key) ? "LIVE" : "test";
    const webhook = Boolean(process.env[`STRIPE_WEBHOOK_SECRET_${house.id.toUpperCase()}`]?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim());
    return { house: house.name, text: `${own ? "Own account" : "Shared account"} · ${mode}${webhook ? "" : " · webhook secret missing"}`, ok: webhook };
  });
}

function emailLine(b: Booking) {
  const parts: string[] = [];
  if (b.status === "pending" || b.status === "confirmed" || b.status === "declined") {
    parts.push(b.emails.hosts ? `Hosts notified ${clock(b.emails.hosts)}` : "Hosts NOT notified");
    parts.push(b.emails.guest ? `“Deposit received” sent ${clock(b.emails.guest)}` : "Guest NOT emailed yet");
  }
  if (b.status === "confirmed") parts.push(b.emails.confirmed ? `Confirmation sent ${clock(b.emails.confirmed)}` : "Confirmation NOT sent");
  if (b.status === "declined") parts.push(b.emails.declined ? `Refund email sent ${clock(b.emails.declined)}` : "Refund email NOT sent");
  return parts;
}

/* ── Page ──────────────────────────────────────────────── */

export default async function AdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const admin = await currentAdmin();
  if (!admin) {
    const problem = hostSetupProblem(emailConfigured());
    return (
      <div className="checkout-page">
        <Header sections={false} />
        <main className="checkout host" id="top">
          <div className="success-card">
            <p className="eyebrow">{appEnv() === "test" ? "Test site" : "Sea & Ski"}</p>
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

  const params = await searchParams;
  const view: View = VIEWS.includes(params.view as View) ? (params.view as View) : "today";
  const month = parseMonth(params.m);
  const span = parseSpan(params.span);
  const today = todayAtHouses();
  const link = (changes: Record<string, string | null>) => {
    const next: Record<string, string | undefined> = { ...params, ...Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v ?? undefined])) };
    if (next.view === "today") delete next.view;
    const qs = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => Boolean(e[1]))).toString();
    return qs ? `/admin?${qs}` : "/admin";
  };
  const go = (v: View) => link({ view: v, b: null, ...(v === "calendar" ? {} : { m: null, span: null }) });

  const dbProblem = paymentsEnabled() ? await databaseUpkeep() : null;
  let bookings: Booking[] = [];
  let directReviews: DirectReview[] = [];
  let problem: string | null = null;
  if (!paymentsEnabled()) problem = "Stripe isn’t connected yet. Add STRIPE_SECRET_KEY to the environment settings.";
  else {
    try {
      const [list, paid, reviews] = await Promise.all([listBookings(), paidBalances(), listDirectReviews()]);
      bookings = list.map((b) => (paid.has(b.ref) ? { ...b, balancePaid: true } : b));
      directReviews = reviews;
    } catch {
      problem = dbConfigured() ? "The database or Stripe didn’t respond. Try again in a moment." : "Stripe didn’t respond. Try again in a moment.";
    }
  }
  problem = problem ?? dbProblem;

  const needsCalendar = view === "calendar";
  const range = monthRange(month, span);
  const [calendar, other, questions, reviewReports, optOuts] = await Promise.all([
    needsCalendar && paymentsEnabled()
      ? dbConfigured()
        ? calendarBookings(range.from, range.to).catch(() => bookings.filter(isLive))
        : Promise.resolve(bookings.filter(isLive))
      : Promise.resolve([] as Booking[]),
    needsCalendar ? otherChannelNights() : Promise.resolve(null),
    dbConfigured() ? listQuestions().catch(() => [] as QuestionRow[]) : Promise.resolve([] as QuestionRow[]),
    view === "setup" ? Promise.all([loadAirbnbReviews("kaja"), loadAirbnbReviews("janis")]) : Promise.resolve(null),
    dbConfigured() ? listOptOuts().catch(() => new Map<string, string>()) : Promise.resolve(new Map<string, string>()),
  ]);

  const pending = bookings.filter((b) => b.status === "pending");
  const newReviews = directReviews.filter((r) => r.status === "pending");
  const recentQuestions = questions.filter((q) => Date.now() - new Date(q.created_at).getTime() < 7 * 86_400_000);
  const silent = silentWebhook(bookings);
  const selected = params.b ? (bookings.find((b) => b.ref === params.b) ?? calendar.find((b) => b.ref === params.b) ?? null) : null;
  const events = selected && dbConfigured() ? await bookingEvents(selected.ref).catch(() => []) : [];

  const nav: Array<{ id: View; label: string; badge?: number; mobile?: boolean }> = [
    { id: "today", label: "Today", badge: pending.length, mobile: true },
    { id: "calendar", label: "Calendar", mobile: true },
    { id: "bookings", label: "Bookings", mobile: true },
    { id: "guests", label: "Guests" },
    { id: "revenue", label: "Revenue", mobile: true },
    { id: "reviews", label: "Reviews", badge: newReviews.length },
    { id: "inbox", label: "Questions", badge: recentQuestions.length },
    { id: "setup", label: "Setup" },
  ];
  const env = appEnv() === "test" ? "Test site" : "Live site";

  return (
    <div className={`adm${appEnv() === "test" ? " is-test" : ""}`}>
      <aside className="adm-side" aria-label="Admin">
        <a className="adm-brand" href="/admin">
          <Mark tone="light" size={44} />
          <span>
            <b>Sea &amp; Ski</b>
            <small>Host admin</small>
          </span>
        </a>
        <nav className="adm-nav">
          {nav.map((item) => (
            <a key={item.id} href={go(item.id)} aria-current={view === item.id ? "page" : undefined}>
              <Icon name={item.id} />
              <span>{item.label}</span>
              {item.badge ? <em>{item.badge}</em> : null}
            </a>
          ))}
        </nav>
        <div className="adm-side-foot">
          <span className={`adm-env${appEnv() === "test" ? " is-test" : ""}`}>{env}</span>
          <small title={admin}>{admin}</small>
          <div className="adm-side-links">
            <a href="/" target="_blank" rel="noreferrer">
              View website ↗
            </a>
          </div>
          <HostLogout />
        </div>
      </aside>

      <nav className="adm-tabbar" aria-label="Admin">
        {[...nav.filter((n) => n.mobile), { id: "more" as View, label: "More", badge: newReviews.length + recentQuestions.length }].map((item) => (
          <a
            key={item.id}
            href={go(item.id)}
            aria-current={view === item.id || (item.id === "more" && ["guests", "reviews", "inbox", "setup", "more"].includes(view)) ? "page" : undefined}
          >
            <Icon name={item.id} size={22} />
            <span>{item.label}</span>
            {item.badge ? <em>{item.badge}</em> : null}
          </a>
        ))}
      </nav>

      <main className="adm-main" id="top">
        {problem ? <p className="adm-alert is-error">{problem}</p> : null}
        {!problem && silent.length ? (
          <div className="adm-alert is-error">
            <b>
              {plural(silent.length, "paid booking")} never triggered the “new booking” email ({silent.map((b) => b.ref).join(", ")}).
            </b>{" "}
            Stripe isn’t reaching the site, or email sending failed. In each house’s Stripe account open Workbench → Webhooks → your endpoint →{" "}
            <b>Event deliveries</b>: the URL must be <b>{getSiteUrl()}/api/stripe/webhook</b> with payment_intent.succeeded and
            payment_intent.payment_failed, and deliveries must show 200. A 400 means the signing secret in Vercel doesn’t match. Then press
            “Resend emails” on each booking.
          </div>
        ) : null}

        {view === "today" ? (
          <TodayView bookings={bookings} pending={pending} today={today} link={link} go={go} newReviews={newReviews.length} questions={recentQuestions.length} />
        ) : null}
        {view === "calendar" ? (
          <>
            <PageHead title="Calendar" sub="Plan the season at a glance. Tap a direct stay to open it." />
            <BookingCalendar
              month={month}
              span={span}
              today={today}
              bookings={calendar}
              other={other ?? { kaja: { airbnb: new Set(), booking: new Set() }, janis: { airbnb: new Set(), booking: new Set() } }}
              link={link}
            />
            <Agenda bookings={bookings} today={today} from={today < range.from ? range.from : today} days={21} link={link} />
          </>
        ) : null}
        {view === "bookings" ? <BookingsView bookings={bookings} today={today} link={link} /> : null}
        {view === "guests" ? <GuestsView guests={guestList(bookings, today, optOuts)} today={today} link={link} /> : null}
        {view === "revenue" ? <RevenueView bookings={bookings} year={Number(params.y) || Number(today.slice(0, 4))} today={today} link={link} /> : null}
        {view === "reviews" ? <ReviewsView reviews={directReviews} /> : null}
        {view === "inbox" ? <InboxView questions={questions} database={dbConfigured()} /> : null}
        {view === "setup" ? <SetupView reviewReports={reviewReports} /> : null}
        {view === "more" ? <MoreView nav={nav} go={go} /> : null}
      </main>

      {params.b ? (
        <BookingDrawer
          booking={selected}
          refId={params.b}
          events={events}
          closeHref={link({ b: null })}
          others={selected ? bookings.filter((o) => o.ref !== selected.ref && isLive(o) && o.email.toLowerCase() === selected.email.toLowerCase()) : []}
          guest={selected ? (guestList(bookings, today, optOuts).find((g) => g.key === (selected.email || selected.name).trim().toLowerCase()) ?? null) : null}
          link={link}
        />
      ) : null}
    </div>
  );
}

function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="adm-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p className="adm-sub">{sub}</p> : null}
      </div>
      {children ? <div className="adm-head-tools">{children}</div> : null}
    </header>
  );
}

type Link = (changes: Record<string, string | null>) => string;

/* ── Today ─────────────────────────────────────────────── */

function TodayView({
  bookings,
  pending,
  today,
  link,
  go,
  newReviews,
  questions,
}: {
  bookings: Booking[];
  pending: Booking[];
  today: string;
  link: Link;
  go: (v: View) => string;
  newReviews: number;
  questions: number;
}) {
  const mv = movements(bookings, today, 14);
  const year = today.slice(0, 4);
  const thisYear = money(bookings.filter((b) => b.checkIn.startsWith(year)));
  const upcoming = bookings.filter((b) => isLive(b) && b.checkIn >= today);
  const cashUpcoming = upcoming.filter((b) => !b.balancePaid).reduce((s, b) => s + b.balance, 0);
  const cashOverdue = bookings.filter((b) => b.status === "confirmed" && !b.balancePaid && b.checkIn < today);
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Sofia" }));
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const week = mv.nextArrivals.filter((b) => b.checkIn <= addDays(today, 7));

  return (
    <>
      <PageHead title={hello} sub={new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} />

      <div className="adm-kpis">
        <a className={`adm-kpi${pending.length ? " is-warn" : ""}`} href="#attention">
          <small>Waiting for you</small>
          <b>{pending.length}</b>
          <span>{pending.length ? "Confirm or decline within 48 h" : "Nothing to decide"}</span>
        </a>
        <a className="adm-kpi" href="#today">
          <small>Staying now</small>
          <b>{mv.inHouse.length}</b>
          <span>{mv.inHouse.length ? mv.inHouse.map((b) => `${firstName(b.name)} · ${HOUSES.find((h) => h.id === b.property)?.short}`).join(", ") : "Both houses empty of direct guests"}</span>
        </a>
        <a className="adm-kpi" href="#next">
          <small>Arriving in 7 days</small>
          <b>{week.length}</b>
          <span>{week.length ? `Next: ${firstName(week[0].name)}, ${formatDay(week[0].checkIn)}` : "No direct arrivals this week"}</span>
        </a>
        <a className="adm-kpi" href={go("revenue")}>
          <small>Cash to collect</small>
          <b>{money0(cashUpcoming)}</b>
          <span>Balances due at upcoming check-ins</span>
        </a>
        <a className="adm-kpi is-dark" href={go("revenue")}>
          <small>Direct revenue {year}</small>
          <b>{money0(thisYear.booked)}</b>
          <span>{plural(thisYear.stays, "stay")} · {plural(thisYear.nights, "night")}</span>
        </a>
      </div>

      <div className="adm-cols">
        <section className="adm-card" id="attention">
          <div className="adm-card-head">
            <h2>Needs attention</h2>
          </div>
          {pending.length === 0 && cashOverdue.length === 0 && !newReviews && !questions ? (
            <p className="adm-empty">All clear. Nothing needs you right now.</p>
          ) : null}
          {pending.map((b) => (
            <article className="adm-task is-warn" key={b.ref}>
              <div className="adm-task-top">
                <a href={link({ b: b.ref })} className="adm-task-title">
                  <b>{b.name}</b> · {HOUSE_NAME[b.property]}
                </a>
                <span className="adm-pill is-warn">Paid {waitingFor(b.createdAt)}</span>
              </div>
              <p className="adm-task-meta">
                {formatDay(b.checkIn)} → {formatDay(b.checkOut)} · {plural(nightsBetween(b.checkIn, b.checkOut), "night")} · {plural(b.guests, "guest")} ·{" "}
                <b>{money0(b.directTotal)}</b> ({money0(b.deposit)} deposit paid)
              </p>
              {b.note ? <p className="adm-task-note">“{b.note}”</p> : null}
              <HostActions id={b.paymentIntentId} status={b.status} balancePaid={b.balancePaid} />
            </article>
          ))}
          {cashOverdue.map((b) => (
            <a className="adm-task is-link" key={`cash-${b.ref}`} href={link({ b: b.ref })}>
              <span className="adm-task-title">
                Cash balance not marked received · <b>{b.name}</b>
              </span>
              <span className="adm-task-meta">
                {money0(b.balance)} · checked in {formatDay(b.checkIn)} at {HOUSE_NAME[b.property]}
              </span>
            </a>
          ))}
          {newReviews ? (
            <a className="adm-task is-link" href={go("reviews")}>
              <span className="adm-task-title">{plural(newReviews, "new guest review")} to publish or keep off the website</span>
            </a>
          ) : null}
          {questions ? (
            <a className="adm-task is-link" href={go("inbox")}>
              <span className="adm-task-title">{plural(questions, "question")} from the website this week</span>
            </a>
          ) : null}
        </section>

        <section className="adm-card" id="today">
          <div className="adm-card-head">
            <h2>Today</h2>
          </div>
          <Movement title="Arriving" list={mv.arrivalsToday} empty="No direct arrivals today." link={link} kind="in" />
          <Movement title="Leaving (clean after)" list={mv.departuresToday} empty="No direct departures today." link={link} kind="out" />
          <Movement title="Staying" list={mv.inHouse.filter((b) => b.checkIn !== today)} empty="Nobody mid-stay." link={link} kind="stay" />
        </section>
      </div>

      <div id="next">
        <Agenda bookings={bookings} today={today} from={addDays(today, 1)} days={14} link={link} title="Next two weeks" />
      </div>
    </>
  );
}

function Movement({ title, list, empty, link, kind }: { title: string; list: Booking[]; empty: string; link: Link; kind: "in" | "out" | "stay" }) {
  return (
    <div className="adm-move">
      <h3>
        {title} <span>{list.length}</span>
      </h3>
      {list.length ? (
        <ul>
          {list.map((b) => (
            <li key={b.ref}>
              <a href={link({ b: b.ref })}>
                <span className="adm-avatar" data-house={b.property}>
                  {initials(b.name)}
                </span>
                <span>
                  <b>{b.name}</b>
                  <small>
                    {HOUSE_NAME[b.property]} · {plural(b.guests, "guest")}
                    {kind === "in" ? ` · arrives ${b.arrival || "time not given"}` : ""}
                    {kind === "stay" ? ` · leaves ${formatDay(b.checkOut)}` : ""}
                    {kind === "in" && !b.balancePaid && b.status === "confirmed" ? ` · collect ${money0(b.balance)} cash` : ""}
                  </small>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-empty">{empty}</p>
      )}
    </div>
  );
}

/** Day-by-day list of direct arrivals and departures. */
function Agenda({ bookings, today, from, days, link, title = "Coming up" }: { bookings: Booking[]; today: string; from: string; days: number; link: Link; title?: string }) {
  const live = bookings.filter(isLive);
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const rows = dates
    .map((date) => ({
      date,
      ins: live.filter((b) => b.checkIn === date),
      outs: live.filter((b) => b.checkOut === date),
    }))
    .filter((r) => r.ins.length || r.outs.length);
  return (
    <section className="adm-card">
      <div className="adm-card-head">
        <h2>{title}</h2>
        <span className="adm-sub">Direct stays · arrivals and departures</span>
      </div>
      {rows.length ? (
        <ol className="adm-agenda">
          {rows.map((r) => (
            <li key={r.date}>
              <time dateTime={r.date}>
                <small>{r.date === today ? "Today" : weekday(r.date)}</small>
                <b>{Number(r.date.slice(8))}</b>
                <small>{new Date(`${r.date}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</small>
              </time>
              <div>
                {r.outs.map((b) => (
                  <a key={`o-${b.ref}`} href={link({ b: b.ref })} className="adm-agenda-item is-out">
                    <span className="adm-tag">Check-out</span> {b.name} · {HOUSE_NAME[b.property]} <small>clean before the next guests</small>
                  </a>
                ))}
                {r.ins.map((b) => (
                  <a key={`i-${b.ref}`} href={link({ b: b.ref })} className="adm-agenda-item is-in">
                    <span className="adm-tag">Check-in</span> {b.name} · {HOUSE_NAME[b.property]}{" "}
                    <small>
                      {plural(b.guests, "guest")} · {plural(nightsBetween(b.checkIn, b.checkOut), "night")}
                      {b.arrival ? ` · arrives ${b.arrival}` : ""}
                      {b.status === "pending" ? " · not confirmed yet" : !b.balancePaid ? ` · ${money0(b.balance)} cash due` : ""}
                    </small>
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="adm-empty">No direct arrivals or departures in the next {days} days.</p>
      )}
    </section>
  );
}

/* ── Bookings ──────────────────────────────────────────── */

function bookingTags(b: Booking, today: string) {
  const tags: string[] = [b.property];
  if (b.status === "pending") tags.push("waiting");
  if (isLive(b) && b.checkIn > today) tags.push("upcoming");
  if (isLive(b) && b.checkIn <= today && b.checkOut > today) tags.push("staying");
  if (isLive(b) && b.checkOut <= today) tags.push("past");
  if (b.status === "confirmed" && !b.balancePaid) tags.push("cash");
  if (!isLive(b)) tags.push("declined");
  return tags.join(" ");
}

function BookingsView({ bookings, today, link }: { bookings: Booking[]; today: string; link: Link }) {
  const rows = bookings.slice().sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  return (
    <>
      <PageHead title="Bookings" sub={`${plural(bookings.filter(isLive).length, "paid direct booking")} · newest stays first`}>
        <a className="adm-btn" href="/api/admin/export?type=bookings">
          Export CSV
        </a>
      </PageHead>
      <section className="adm-card">
        <FilterBox
          target="booking-table"
          placeholder="Search name, email, phone or reference"
          chips={[
            { value: "waiting", label: "Waiting" },
            { value: "upcoming", label: "Upcoming" },
            { value: "staying", label: "Staying now" },
            { value: "cash", label: "Cash due" },
            { value: "past", label: "Past" },
            { value: "declined", label: "Declined" },
            { value: "kaja", label: "Villa Kaja" },
            { value: "janis", label: "Jani’s" },
          ]}
        />
        <div className="adm-table-wrap" id="booking-table">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>House</th>
                <th>Stay</th>
                <th className="num">Guests</th>
                <th className="num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.ref} data-search={`${b.name} ${b.email} ${b.phone} ${b.ref} ${HOUSE_NAME[b.property]}`} data-tags={bookingTags(b, today)}>
                  <td>
                    <a className="adm-row-link" href={link({ b: b.ref })}>
                      <span className="adm-avatar" data-house={b.property}>
                        {initials(b.name)}
                      </span>
                      <span>
                        <b>{b.name}</b>
                        <small>{b.ref}</small>
                      </span>
                    </a>
                  </td>
                  <td>{HOUSES.find((h) => h.id === b.property)?.short}</td>
                  <td>
                    {formatDay(b.checkIn)} → {formatDay(b.checkOut)} {b.checkIn.slice(0, 4)}
                    <small className="adm-block">{plural(nightsBetween(b.checkIn, b.checkOut), "night")}</small>
                  </td>
                  <td className="num">{b.guests}</td>
                  <td className="num">{money0(b.directTotal)}</td>
                  <td>
                    <Pill b={b} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="adm-empty" data-empty hidden={rows.length > 0}>
            No bookings match.
          </p>
        </div>
      </section>
    </>
  );
}

/* ── Guests ────────────────────────────────────────────── */

function GuestsView({ guests, today, link }: { guests: Guest[]; today: string; link: Link }) {
  const repeat = guests.filter((g) => g.repeat).length;
  const offers = guests.filter((g) => g.offersOk);
  return (
    <>
      <PageHead
        title="Guests"
        sub={`${plural(guests.length, "guest")} who paid for a direct stay · ${repeat} came back more than once · ${offers.length} agreed to offers by email`}
      >
        <a className="adm-btn" href="/api/admin/export?type=guests">
          Export CSV
        </a>
      </PageHead>
      <section className="adm-card">
        <FilterBox
          target="guest-table"
          placeholder="Search guests"
          chips={[
            { value: "offers", label: "OK to email offers" },
            { value: "repeat", label: "Repeat guests" },
            { value: "upcoming", label: "Upcoming stay" },
            { value: "kaja", label: "Villa Kaja" },
            { value: "janis", label: "Jani’s" },
          ]}
        />
        <div className="adm-table-wrap" id="guest-table">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Contact</th>
                <th className="num">Stays</th>
                <th className="num">Nights</th>
                <th className="num">Spent</th>
                <th>Last / next stay</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr
                  key={g.key}
                  data-search={`${g.name} ${g.email} ${g.phone} ${g.refs.join(" ")}`}
                  data-tags={[...g.houses, g.repeat ? "repeat" : "", g.nextStay ? "upcoming" : "", g.offersOk ? "offers" : ""].join(" ")}
                >
                  <td>
                    <a className="adm-row-link" href={link({ b: g.latestRef })}>
                      <span className="adm-avatar" data-house={g.houses[0]}>
                        {initials(g.name)}
                      </span>
                      <span>
                        <b>
                          {g.name} {g.repeat ? <span className="adm-pill is-ok">Repeat</span> : null}{" "}
                          {g.offersOk ? (
                            <span className="adm-pill is-info" title={`Agreed ${g.offersSince?.slice(0, 10)}`}>
                              Offers ✓
                            </span>
                          ) : null}
                        </b>
                        <small>{g.houses.map((h) => HOUSE_NAME[h]).join(" · ")}</small>
                      </span>
                    </a>
                  </td>
                  <td>
                    <a href={`mailto:${g.email}`}>{g.email}</a>
                    <small className="adm-block">
                      <a href={`tel:${g.phone}`}>{g.phone}</a>
                    </small>
                  </td>
                  <td className="num">{g.stays}</td>
                  <td className="num">{g.nights}</td>
                  <td className="num">{money0(g.spent)}</td>
                  <td>
                    {g.lastStay ? formatLong(g.lastStay) : "—"}
                    {g.nextStay ? <small className="adm-block">Next: {g.nextStay === today ? "today" : formatLong(g.nextStay)}</small> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="adm-empty" data-empty hidden={guests.length > 0}>
            No guests yet.
          </p>
        </div>
        <p className="adm-fine">
          Only email offers to guests marked “Offers ✓”: they ticked the optional box at checkout. Every offer email must include the
          guest’s own unsubscribe link (in the CSV export, column “Unsubscribe link”). Guests who unsubscribe drop off this list
          automatically. Everyone else gets booking emails only.
        </p>
      </section>
    </>
  );
}

/* ── Revenue ───────────────────────────────────────────── */

function RevenueChart({ bars }: { bars: MonthBar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.kaja + b.janis));
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  const W = 720;
  const H = 240;
  const left = 52;
  const bottom = 26;
  const inner = H - bottom - 10;
  const bw = (W - left) / 12;
  const y = (v: number) => H - bottom - (v / top) * inner;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);
  return (
    <svg className="adm-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Direct revenue by month of check-in, by house">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W} y1={y(t)} y2={y(t)} className="grid" />
          <text x={left - 8} y={y(t) + 4} textAnchor="end" className="tick">
            {t >= 1000 ? `€${Math.round(t / 100) / 10}k` : `€${Math.round(t)}`}
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = left + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const hk = (b.kaja / top) * inner;
        const hj = (b.janis / top) * inner;
        return (
          <g key={b.month}>
            <title>{`${b.label}: Villa Kaja ${formatMoney(b.kaja)} (${b.nights.kaja} nights) · Jani’s ${formatMoney(b.janis)} (${b.nights.janis} nights)`}</title>
            {hk > 0 ? <rect x={x} y={y(b.kaja)} width={w} height={hk} rx={3} className="is-kaja" /> : null}
            {hj > 0 ? <rect x={x} y={y(b.kaja + b.janis)} width={w} height={hj} rx={3} className="is-janis" /> : null}
            <text x={x + w / 2} y={H - 8} textAnchor="middle" className="tick">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RevenueView({ bookings, year, today, link }: { bookings: Booking[]; year: number; today: string; link: Link }) {
  const inYear = bookings.filter((b) => b.checkIn.startsWith(String(year)));
  const lastYear = money(bookings.filter((b) => b.checkIn.startsWith(String(year - 1))));
  const m = money(inYear);
  const bars = monthlyRevenue(bookings, year);
  const years = revenueYears(bookings, Number(today.slice(0, 4)));
  const delta = lastYear.booked ? (m.booked - lastYear.booked) / lastYear.booked : null;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <>
      <PageHead title="Revenue" sub={`Money from bookings made on this website, by check-in date in ${year}. Airbnb and Booking.com payouts aren’t included.`}>
        <nav className="adm-seg" aria-label="Year">
          {years.map((y) => (
            <a key={y} href={link({ y: y === Number(today.slice(0, 4)) ? null : String(y) })} aria-current={y === year ? "true" : undefined}>
              {y}
            </a>
          ))}
        </nav>
      </PageHead>

      <div className="adm-kpis">
        <div className="adm-kpi is-dark">
          <small>Booked</small>
          <b>{money0(m.booked)}</b>
          <span>
            {delta === null ? `${plural(m.stays, "stay")}` : `${delta >= 0 ? "▲" : "▼"} ${pct(Math.abs(delta))} vs ${year - 1} (${money0(lastYear.booked)})`}
          </span>
        </div>
        <div className="adm-kpi">
          <small>Received</small>
          <b>{money0(m.collected)}</b>
          <span>Deposits on Stripe + cash marked received</span>
        </div>
        <div className="adm-kpi">
          <small>Cash still to collect</small>
          <b>{money0(m.cashDue)}</b>
          <span>Balances paid at check-in</span>
        </div>
        <div className="adm-kpi">
          <small>Refunded</small>
          <b>{money0(m.refunded)}</b>
          <span>Deposits returned on declined bookings</span>
        </div>
      </div>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>By month</h2>
          <span className="cal-legend">
            <span>
              <i className="cal-key is-kaja" /> Villa Kaja
            </span>
            <span>
              <i className="cal-key is-janis" /> Jani’s Beach House
            </span>
          </span>
        </div>
        <RevenueChart bars={bars} />
      </section>

      <div className="adm-cols">
        <section className="adm-card">
          <div className="adm-card-head">
            <h2>Key numbers</h2>
          </div>
          <dl className="adm-stats">
            <div>
              <dt>Stays</dt>
              <dd>{m.stays}</dd>
            </div>
            <div>
              <dt>Nights booked</dt>
              <dd>{m.nights}</dd>
            </div>
            <div>
              <dt>Average per night</dt>
              <dd>{money0(m.adr)}</dd>
            </div>
            <div>
              <dt>Average stay</dt>
              <dd>{m.avgStay ? `${m.avgStay.toFixed(1)} nights` : "—"}</dd>
            </div>
            <div>
              <dt>Booked ahead</dt>
              <dd>{m.stays ? `${Math.round(m.leadTime)} days` : "—"}</dd>
            </div>
            <div>
              <dt>Average group</dt>
              <dd>{m.stays ? `${(m.guests / m.stays).toFixed(1)} guests` : "—"}</dd>
            </div>
            <div>
              <dt>Declined</dt>
              <dd>{pct(m.declineRate)}</dd>
            </div>
            <div>
              <dt>Stripe fees (est.)</dt>
              <dd>{money0(m.stripeFees)}</dd>
            </div>
          </dl>
        </section>
        <section className="adm-card">
          <div className="adm-card-head">
            <h2>Direct vs Airbnb</h2>
          </div>
          <dl className="adm-stats">
            <div>
              <dt>Guests saved</dt>
              <dd>{money0(m.guestSavings)}</dd>
            </div>
            <div>
              <dt>You kept extra (est.)</dt>
              <dd className={m.keptVsAirbnb < 0 ? "is-neg" : "is-pos"}>{money0(m.keptVsAirbnb)}</dd>
            </div>
          </dl>
          <p className="adm-fine">
            “You kept extra” compares each direct stay (minus Stripe’s fee on the deposit) with what Airbnb would have paid out for the same
            dates, assuming Airbnb’s host-only fee of {Math.round(AIRBNB_HOST_FEE * 1000) / 10}% that applies in Europe from mid-October 2026.
            It’s an estimate: card fees are higher for non-European cards, and older Airbnb bookings had a lower host fee.
          </p>
          <table className="adm-table is-compact">
            <thead>
              <tr>
                <th>House</th>
                <th className="num">Stays</th>
                <th className="num">Nights</th>
                <th className="num">Booked</th>
                <th className="num">Per night</th>
              </tr>
            </thead>
            <tbody>
              {HOUSES.map((h) => {
                const hm = money(inYear.filter((b) => b.property === h.id));
                return (
                  <tr key={h.id}>
                    <td>{h.name}</td>
                    <td className="num">{hm.stays}</td>
                    <td className="num">{hm.nights}</td>
                    <td className="num">{money0(hm.booked)}</td>
                    <td className="num">{hm.nights ? money0(hm.adr) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

/* ── Reviews, questions, setup ─────────────────────────── */

function ReviewsView({ reviews }: { reviews: DirectReview[] }) {
  return (
    <>
      <PageHead title="Guest reviews" sub="Guests are emailed a review link the day after check-out. Reviews show on the house page only after you publish them." />
      <p className="adm-fine adm-note">
        Publish honest reviews too, not only the best ones: guests trust a mix, and hiding criticism isn’t allowed under EU consumer rules.
        Keep “Don’t publish” for reviews that are abusive, off-topic or contain personal details.
      </p>
      <div className="adm-list">
        {reviews.length ? (
          reviews.map((r) => (
            <article className={`adm-card adm-review is-${r.status}`} key={r.paymentIntentId}>
              <div className="adm-task-top">
                <div>
                  <p className="adm-eyebrow">
                    {HOUSE_NAME[r.property]} · {r.ref} · stayed {r.stayMonth}
                  </p>
                  <h3>
                    <span className="adm-stars" aria-label={`${r.rating} out of 5`}>
                      {"★".repeat(r.rating)}
                      <i>{"★".repeat(5 - r.rating)}</i>
                    </span>{" "}
                    {r.name}
                  </h3>
                </div>
                <span className={`adm-pill is-${r.status === "published" ? "ok" : r.status === "hidden" ? "muted" : "warn"}`}>
                  {r.status === "pending" ? "New" : r.status === "published" ? "On the website" : "Not published"}
                </span>
              </div>
              <blockquote className="adm-quote">{r.text}</blockquote>
              <ReviewActions id={r.paymentIntentId} mode={r.status} />
            </article>
          ))
        ) : (
          <p className="adm-card adm-empty">No guest reviews yet.</p>
        )}
      </div>
    </>
  );
}

function InboxView({ questions, database }: { questions: QuestionRow[]; database: boolean }) {
  return (
    <>
      <PageHead title="Questions" sub="Sent from the “Ask a question” form on the house pages. Each one was also emailed to the hosts." />
      <div className="adm-list">
        {!database ? <p className="adm-card adm-empty">Questions are kept here once the database is connected. Until then they arrive by email only.</p> : null}
        {database && !questions.length ? <p className="adm-card adm-empty">No questions yet.</p> : null}
        {questions.map((q) => {
          const house = q.property === "kaja" || q.property === "janis" ? HOUSE_NAME[q.property] : "Website";
          const subject = encodeURIComponent(`Re: your question about ${house}`);
          return (
            <article className="adm-card adm-question" key={q.id}>
              <div className="adm-task-top">
                <div>
                  <p className="adm-eyebrow">
                    {house} · {clock(new Date(q.created_at).toISOString())}
                  </p>
                  <h3>{q.name}</h3>
                </div>
                <a className="adm-btn is-primary" href={`mailto:${q.email}?subject=${subject}`}>
                  Reply by email
                </a>
              </div>
              <p className="adm-quote">{q.message}</p>
              <small className="adm-sub">{q.email}</small>
            </article>
          );
        })}
      </div>
    </>
  );
}

function SetupView({ reviewReports }: { reviewReports: Array<{ reviews: unknown[]; notes: string[] }> | null }) {
  const stripe = stripeSetup();
  const same = secretKeyFor("kaja") === secretKeyFor("janis") && Boolean(secretKeyFor("kaja"));
  const rows: Array<{ label: string; value: React.ReactNode; ok: boolean }> = [
    { label: "Site", value: `${appEnv() === "test" ? "TEST site (Stripe test mode)" : "Live site"} · ${getSiteUrl()}`, ok: true },
    ...stripe.map((s) => ({ label: `Payments · ${s.house}`, value: s.text, ok: s.ok })),
    ...(same ? [{ label: "Stripe", value: "Both houses use the same Stripe account", ok: true }] : []),
    {
      label: "Records",
      value: dbConfigured()
        ? `Database (Neon, ${databaseEnvKey()}), with a backup copy on each payment in Stripe`
        : "No database connected yet, so bookings are read from Stripe only",
      ok: dbConfigured(),
    },
    { label: "Email", value: emailConfigured() ? `Notifications go to ${notifyEmails().join(", ")}` : "Email isn’t set up, so no emails are being sent", ok: emailConfigured() },
    { label: "Review requests", value: process.env.CRON_SECRET ? "Sent automatically the day after check-out" : "CRON_SECRET missing, so review requests aren’t sent automatically", ok: Boolean(process.env.CRON_SECRET) },
    ...(reviewReports
      ? reviewReports.map((r, i) => ({
          label: `Airbnb reviews · ${HOUSES[i].name}`,
          value: `${r.reviews.length} shown on the house page${r.reviews.length ? "" : ` (${r.notes.join("; ") || "Airbnb returned none"})`}`,
          ok: r.reviews.length > 0,
        }))
      : []),
  ];
  return (
    <>
      <PageHead title="Setup" sub="How the site is connected. Keys and secrets are never shown here." />
      <section className="adm-card">
        <ul className="adm-checks">
          {rows.map((r) => (
            <li key={r.label} className={r.ok ? "is-ok" : "is-bad"}>
              <span aria-hidden="true">{r.ok ? "✓" : "!"}</span>
              <div>
                <b>{r.label}</b>
                <small>{r.value}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="adm-card">
        <div className="adm-card-head">
          <h2>How bookings work</h2>
        </div>
        <p className="adm-sub">
          Guests pay a 50% deposit at checkout. Confirm to send them their confirmation email and PDF; decline to refund the deposit in full.
          Paid dates are blocked on this site straight away. Block them on Airbnb and Booking.com when you confirm. The balance is paid in cash at
          check-in: mark it as received on the booking.
        </p>
        <div className="adm-actions">
          <a className="adm-btn" href={`https://dashboard.stripe.com/${isTestMode() ? "test/" : ""}payments`} target="_blank" rel="noreferrer">
            Open Stripe ↗
          </a>
          <a className="adm-btn" href="/api/admin/export?type=bookings">
            Download all bookings (CSV)
          </a>
        </div>
      </section>
    </>
  );
}

function MoreView({ nav, go }: { nav: Array<{ id: View; label: string; badge?: number }>; go: (v: View) => string }) {
  return (
    <>
      <PageHead title="More" />
      <nav className="adm-card adm-more">
        {nav.map((item) => (
          <a key={item.id} href={go(item.id)}>
            <Icon name={item.id} />
            <span>{item.label}</span>
            {item.badge ? <em>{item.badge}</em> : null}
            <Icon name="arrow" size={16} />
          </a>
        ))}
        <a href="/" target="_blank" rel="noreferrer">
          <Icon name="out" />
          <span>View website</span>
        </a>
      </nav>
      <div className="adm-more-foot">
        <HostLogout />
      </div>
    </>
  );
}

/* ── Booking side panel ────────────────────────────────── */

function BookingDrawer({
  booking: b,
  refId,
  events,
  closeHref,
  others,
  guest,
  link,
}: {
  guest: Guest | null;
  booking: Booking | null;
  refId: string;
  events: Array<{ at: Date; actor: string; type: string }>;
  closeHref: string;
  others: Booking[];
  link: Link;
}) {
  return (
    <>
      <a className="adm-scrim" href={closeHref} aria-label="Close booking" tabIndex={-1} />
      <aside className="adm-drawer" id="adm-drawer" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="adm-drawer-title">
        <DrawerKeys closeHref={closeHref} />
        <header className="adm-drawer-head">
          <div>
            <p className="adm-eyebrow">{b ? `${HOUSE_NAME[b.property]} · ${b.ref}` : refId}</p>
            <h2 id="adm-drawer-title">{b ? b.name : "Booking not found"}</h2>
            {b ? <Pill b={b} /> : null}
          </div>
          <a className="adm-close" href={closeHref} aria-label="Close">
            ×
          </a>
        </header>
        {!b ? (
          <p className="adm-empty">This booking isn’t in the list. It may be an unpaid checkout.</p>
        ) : (
          <div className="adm-drawer-body">
            <div className="adm-stay">
              <div>
                <small>Check-in</small>
                <b>{formatLong(b.checkIn)}</b>
                <span>{weekday(b.checkIn)} · arrives {b.arrival || "time not given"}</span>
              </div>
              <div className="adm-stay-arrow">
                <Icon name="arrow" />
                <small>{plural(nightsBetween(b.checkIn, b.checkOut), "night")}</small>
              </div>
              <div>
                <small>Check-out</small>
                <b>{formatLong(b.checkOut)}</b>
                <span>{weekday(b.checkOut)}</span>
              </div>
            </div>

            <HostActions id={b.paymentIntentId} status={b.status} balancePaid={b.balancePaid} />

            <section>
              <h3>Guest</h3>
              <dl className="adm-dl">
                <dt>Name</dt>
                <dd>
                  {b.name} · {plural(b.guests, "guest")}
                </dd>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${b.email}`}>{b.email}</a>
                </dd>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${b.phone}`}>{b.phone}</a>
                  {whatsapp(b.phone) ? (
                    <>
                      {" · "}
                      <a href={whatsapp(b.phone)!} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    </>
                  ) : null}
                </dd>
                {b.note ? (
                  <>
                    <dt>Message</dt>
                    <dd className="adm-note-text">{b.note}</dd>
                  </>
                ) : null}
                <dt>Offers</dt>
                <dd>
                  {guest?.offersOk ? (
                    <>
                      Agreed to offers by email {formatDay(guest.offersSince!.slice(0, 10))} {guest.offersSince!.slice(0, 4)} ·{" "}
                      <a href={unsubscribeUrl(b.email)} target="_blank" rel="noreferrer">
                        unsubscribe link
                      </a>{" "}
                      · <RemoveFromOffers email={b.email} refId={b.ref} />
                    </>
                  ) : guest?.optedOutAt ? (
                    `Unsubscribed ${formatDay(guest.optedOutAt.slice(0, 10))} ${guest.optedOutAt.slice(0, 4)}`
                  ) : (
                    "Not agreed · booking emails only"
                  )}
                </dd>
                {others.length ? (
                  <>
                    <dt>Other stays</dt>
                    <dd>
                      {others.map((o, i) => (
                        <span key={o.ref}>
                          {i ? ", " : ""}
                          <a href={link({ b: o.ref })}>
                            {formatDay(o.checkIn)} {o.checkIn.slice(0, 4)} · {HOUSES.find((h) => h.id === o.property)?.short}
                          </a>
                        </span>
                      ))}
                    </dd>
                  </>
                ) : null}
              </dl>
            </section>

            <section>
              <h3>Payment</h3>
              <div className="adm-pay">
                <div>
                  <small>Direct price</small>
                  <b>{formatMoney(b.directTotal)}</b>
                  {b.airbnbTotal ? <span>Airbnb {formatMoney(b.airbnbTotal)}</span> : null}
                </div>
                <div className={b.status === "declined" ? "is-muted" : "is-ok"}>
                  <small>Deposit · Stripe</small>
                  <b>{formatMoney(b.deposit)}</b>
                  <span>{b.status === "declined" ? "Refunded" : isLive(b) ? "Paid" : "Not paid"}</span>
                </div>
                <div className={b.balancePaid ? "is-ok" : b.status === "confirmed" ? "is-warn" : ""}>
                  <small>Balance · cash</small>
                  <b>{formatMoney(b.balance)}</b>
                  <span>{b.balancePaid ? `Received${b.balanceCashBy ? ` by ${b.balanceCashBy}` : ""}` : "Due at check-in"}</span>
                </div>
              </div>
              <div className="adm-actions">
                <a className="adm-btn" href={`https://dashboard.stripe.com/${isTestMode() ? "test/" : ""}payments/${b.paymentIntentId}`} target="_blank" rel="noreferrer">
                  Open in Stripe ↗
                </a>
                {b.status === "confirmed" ? (
                  <a className="adm-btn" href={`/api/admin/pdf?id=${b.paymentIntentId}`}>
                    Confirmation PDF
                  </a>
                ) : null}
              </div>
            </section>

            <section>
              <h3>Emails &amp; review</h3>
              <ul className="adm-mini">
                {emailLine(b).map((line) => (
                  <li key={line} className={/NOT/.test(line) ? "is-bad" : ""}>
                    {line}
                  </li>
                ))}
                {b.status === "confirmed" ? (
                  <li>
                    {b.reviewStatus
                      ? `Review received (${b.reviewStatus === "pending" ? "waiting for you" : b.reviewStatus})`
                      : b.reviewRequestedAt
                        ? `Review requested ${formatDay(b.reviewRequestedAt.slice(0, 10))}`
                        : "Review is asked for automatically the day after check-out"}
                  </li>
                ) : null}
              </ul>
              {b.status === "confirmed" && !b.reviewStatus ? <ReviewActions id={b.paymentIntentId} mode="request" /> : null}
            </section>

            {events.length ? (
              <section>
                <h3>History</h3>
                <ol className="adm-timeline">
                  {events.map((e, i) => (
                    <li key={i}>
                      <b>{e.type.replace(/_/g, " ")}</b>
                      <small>
                        {clock(new Date(e.at).toISOString())} · {e.actor}
                      </small>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            <p className="adm-fine">
              Booked {clock(b.createdAt)}
              {b.confirmedBy ? ` · confirmed by ${b.confirmedBy}` : ""}
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

