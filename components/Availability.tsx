"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalendarDay } from "@/lib/listings";
import type { CalendarSources } from "@/lib/reservations";
import { DEPOSIT_LABEL } from "@/lib/booking-config";
import { DIRECT_DISCOUNT_LABEL, formatMoney, type QuoteResult, type StayQuote } from "@/lib/pricing";
import { stayLink, type PropertyId } from "@/lib/properties";
import { evaluateStay, formatLong, monthGrid, monthLabel } from "@/lib/stay";

type Props = {
  property: PropertyId;
  maxGuests: number;
  defaultGuests: number;
  kicker: string;
  finePrint: string;
  airbnbUrl: string;
  intro: string;
  initialDays: CalendarDay[];
  initialError: string | null;
  initialSources: CalendarSources;
  paymentsOn: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Availability({
  property,
  maxGuests,
  defaultGuests,
  kicker,
  finePrint,
  airbnbUrl,
  intro,
  initialDays,
  initialError,
  initialSources,
  paymentsOn,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date();
  const [cursor, setCursor] = useState({ year: start.getFullYear(), month: start.getMonth() });
  const [days, setDays] = useState(initialDays);
  const [error, setError] = useState(initialError);
  const [sources, setSources] = useState(initialSources);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guests, setGuests] = useState(defaultGuests);
  const [refreshing, setRefreshing] = useState(false);
  const [quote, setQuote] = useState<StayQuote | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [quoteMessage, setQuoteMessage] = useState("");

  const byDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const verdict = checkIn && checkOut ? evaluateStay(days, checkIn, checkOut) : null;
  const stayOk = Boolean(verdict?.ok);

  useEffect(() => {
    if (!stayOk || !checkIn || !checkOut) {
      setQuote(null);
      setQuoteState("idle");
      return;
    }
    const controller = new AbortController();
    setQuoteState("loading");
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ property, checkIn, checkOut, guests: String(guests) });
        const response = await fetch(`/api/quote?${params}`, { signal: controller.signal });
        const data = (await response.json()) as QuoteResult;
        if (data.ok) {
          setQuote(data.quote);
          setQuoteState("ready");
        } else {
          setQuote(null);
          setQuoteMessage(data.message);
          setQuoteState("failed");
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setQuote(null);
        setQuoteMessage("The Airbnb price could not be loaded just now.");
        setQuoteState("failed");
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [stayOk, checkIn, checkOut, guests, property]);
  const lastDay = days.at(-1)?.date ?? today;

  const second = cursor.month === 11
    ? { year: cursor.year + 1, month: 0 }
    : { year: cursor.year, month: cursor.month + 1 };

  function shift(amount: number) {
    const next = new Date(Date.UTC(cursor.year, cursor.month + amount, 1));
    const earliest = new Date();
    earliest.setUTCDate(1);
    if (next.getTime() < Date.UTC(earliest.getFullYear(), earliest.getMonth(), 1)) return;
    if (next.toISOString().slice(0, 10) > lastDay) return;
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }

  function pick(iso: string) {
    const day = byDate.get(iso);
    if (!day || iso < today) return;
    if (!checkIn || (checkIn && checkOut) || iso <= checkIn) {
      if (!day.checkin) return;
      setCheckIn(iso);
      setCheckOut(null);
      return;
    }
    if (!day.checkout) return;
    setCheckOut(iso);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/availability?property=${property}`);
      if (!response.ok) throw new Error("refresh failed");
      const data = (await response.json()) as {
        days: CalendarDay[];
        error: string | null;
        sources?: CalendarSources;
      };
      setDays(data.days);
      setError(data.error);
      if (data.sources) setSources(data.sources);
    } catch {
      setError("The calendars could not be refreshed. Try again in a moment.");
    } finally {
      setRefreshing(false);
    }
  }

  const airbnbHref =
    checkIn && checkOut ? stayLink(airbnbUrl, checkIn, checkOut, guests, "airbnb") : airbnbUrl;

  return (
    <section id="stay" className="section stay-section">
      <div className="section-head">
        <p className="eyebrow">Live dates</p>
        <h2>Pick your dates, see your price</h2>
        <p>{intro}</p>
      </div>

      <div className="stay-layout">
        <div className="stay-main">
        <div className="calendar-panel">
          <div className="calendar-toolbar">
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month">
              ←
            </button>
            <button type="button" onClick={refresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh dates"}
            </button>
            <button type="button" onClick={() => shift(1)} aria-label="Next month">
              →
            </button>
          </div>
          {error ? <p className="calendar-error">{error}</p> : null}
          <div className="months">
            {[cursor, second].map((month) => (
              <Month
                key={`${month.year}-${month.month}`}
                year={month.year}
                month={month.month}
                today={today}
                byDate={byDate}
                checkIn={checkIn}
                checkOut={checkOut}
                onPick={pick}
              />
            ))}
          </div>
          <ul className="legend">
            <li><i className="swatch free" /> Free</li>
            <li><i className="swatch taken" /> Booked</li>
            <li><i className="swatch chosen" /> Your stay</li>
          </ul>
          <p className="sync-note">
            <i aria-hidden="true" />
            {sources.booking === "synced"
              ? "Synced with Airbnb and Booking.com"
              : sources.booking === "failed"
                ? "Synced with Airbnb · Booking.com didn’t respond, the host will double-check"
                : "Synced with Airbnb"}
          </p>
        </div>

        </div>

        <aside className="stay-card">
          <p className="direct-badge">
            <span>−{DIRECT_DISCOUNT_LABEL}</span> Book direct and pay {DIRECT_DISCOUNT_LABEL} less than on Airbnb
          </p>
          <p className="stay-kicker">{kicker}</p>
          <div className="guest-row">
            <span>Guests</span>
            <div>
              <button type="button" onClick={() => setGuests((count) => Math.max(1, count - 1))} aria-label="Fewer guests">
                −
              </button>
              <strong>{guests}</strong>
              <button type="button" onClick={() => setGuests((count) => Math.min(maxGuests, count + 1))} aria-label="More guests">
                +
              </button>
            </div>
          </div>
          <dl className="stay-dates">
            <div>
              <dt>Check-in</dt>
              <dd>{checkIn ? formatLong(checkIn) : "Select a date"}</dd>
            </div>
            <div>
              <dt>Check-out</dt>
              <dd>{checkOut ? formatLong(checkOut) : "Select a date"}</dd>
            </div>
          </dl>
            <>
              <p className={`verdict ${verdict?.ok ? "is-ok" : ""}`}>
                {verdict?.message ?? "Click an arrival date, then a departure date. Minimum stays vary by week."}
              </p>
              {verdict?.ok ? <PriceBox state={quoteState} quote={quote} message={quoteMessage} /> : null}
              {verdict?.ok && checkIn && checkOut ? (
                <>
                  <a
                    className="book-button reserve card-submit"
                    href={`/checkout?${new URLSearchParams({ property, checkIn, checkOut, guests: String(guests) })}`}
                  >
                    {quote ? `Continue to checkout · ${formatMoney(quote.directTotal)}` : "Continue to checkout"}
                  </a>
                  <p className="card-hint">
                    {paymentsOn
                      ? `Pay a ${DEPOSIT_LABEL} deposit at checkout; the rest is charged before arrival.`
                      : "At checkout you send your details; the host confirms by email and sends a secure payment link."}
                  </p>
                </>
              ) : (
                <button className="book-button reserve is-disabled" type="button" disabled>
                  Continue to checkout
                </button>
              )}
            </>
          <p className="fine-print">{finePrint} A request on this page is not a confirmed stay.</p>
          <p className="airbnb-alt">
            Prefer Airbnb?{" "}
            <a href={verdict?.ok ? airbnbHref : airbnbUrl} target="_blank" rel="noreferrer">
              Book there at the full price
            </a>
          </p>
        </aside>
      </div>
      <div className={`mobile-bar${verdict?.ok && checkIn && checkOut ? " has-stay" : ""}`}>
        {verdict?.ok && checkIn && checkOut ? (
          <>
            <span className="mobile-bar-price">
              <strong>{quote ? formatMoney(quote.directTotal) : quoteState === "loading" ? "…" : "Your stay"}</strong>
              <small>
                {verdict.nights} night{verdict.nights === 1 ? "" : "s"} · {guests} guest{guests === 1 ? "" : "s"}
                {quote ? ` · save ${formatMoney(quote.savings)}` : ""}
              </small>
            </span>
            <a href={`/checkout?${new URLSearchParams({ property, checkIn, checkOut, guests: String(guests) })}`}>
              Continue to checkout
            </a>
          </>
        ) : (
          <>
            <span className="mobile-bar-price">
              <strong>−{DIRECT_DISCOUNT_LABEL}</strong>
              <small>vs Airbnb when you book here</small>
            </span>
            <a href="#stay">Choose dates</a>
          </>
        )}
      </div>
    </section>
  );
}

function Month({
  year,
  month,
  today,
  byDate,
  checkIn,
  checkOut,
  onPick,
}: {
  year: number;
  month: number;
  today: string;
  byDate: Map<string, CalendarDay>;
  checkIn: string | null;
  checkOut: string | null;
  onPick: (iso: string) => void;
}) {
  return (
    <div className="month">
      <h3>{monthLabel(year, month)}</h3>
      <div className="weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="days">
        {monthGrid(year, month).map((iso, index) => {
          if (!iso) return <span key={`empty-${index}`} />;
          const day = byDate.get(iso);
          const past = iso < today;
          const inRange = Boolean(checkIn && checkOut && iso > checkIn && iso < checkOut);
          const endpoint = iso === checkIn || iso === checkOut;
          const taken = Boolean(day && !day.available);
          const disabled = past || !day || (taken && !day.checkout && iso !== checkIn);
          return (
            <button
              key={iso}
              type="button"
              disabled={past || !day}
              className={[
                taken ? "is-taken" : "",
                inRange ? "is-range" : "",
                endpoint ? "is-end" : "",
                past ? "is-past" : "",
                disabled && !endpoint ? "is-muted" : "",
              ].join(" ")}
              onClick={() => onPick(iso)}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PriceBox({ state, quote, message }: { state: "idle" | "loading" | "ready" | "failed"; quote: StayQuote | null; message: string }) {
  if (state === "loading") {
    return (
      <div className="price-box is-loading" aria-live="polite">
        <span className="price-skeleton" />
        <span className="price-skeleton short" />
        <p>Checking the Airbnb price for these dates…</p>
      </div>
    );
  }
  if (state === "ready" && quote) {
    return (
      <div className="price-box" aria-live="polite">
        <div className="price-row airbnb">
          <span>On Airbnb</span>
          <s>{formatMoney(quote.airbnbTotal)}</s>
        </div>
        <div className="price-row direct">
          <span>
            Booking direct
            <small>
              {quote.nights} night{quote.nights === 1 ? "" : "s"} · about {formatMoney(quote.perNight)} a night
            </small>
          </span>
          <strong>{formatMoney(quote.directTotal)}</strong>
        </div>
        <p className="price-save">
          You save <b>{formatMoney(quote.savings)}</b> ({DIRECT_DISCOUNT_LABEL}) compared with Airbnb’s total for the same dates.
        </p>
      </div>
    );
  }
  if (state === "failed") {
    return (
      <div className="price-box is-failed" aria-live="polite">
        <p>
          {message} Send the request anyway: the host will confirm your price, {DIRECT_DISCOUNT_LABEL} below Airbnb’s
          total.
        </p>
      </div>
    );
  }
  return null;
}
