"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarDay } from "@/lib/listings";
import type { CalendarSources } from "@/lib/reservations";
import { DEPOSIT_LABEL } from "@/lib/booking-config";
import { SecurePay } from "./SecurePay";
import { Icon } from "./Icons";
import { DIRECT_DISCOUNT_LABEL, formatMoney, type QuoteResult, type StayQuote } from "@/lib/pricing";
import { stayLink, type PropertyId } from "@/lib/properties";
import { evaluateStay, formatLong, monthGrid, monthLabel } from "@/lib/stay";
import { track } from "@/lib/track";

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
  const [quoteAttempt, setQuoteAttempt] = useState(0);

  const byDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const verdict = checkIn && checkOut ? evaluateStay(days, checkIn, checkOut) : null;
  const stayOk = Boolean(verdict?.ok);

  // Analytics: who sees the calendar, who uses it, which stays they look at.
  const sectionRef = useRef<HTMLElement>(null);
  const usedRef = useRef(false);
  const lastStayRef = useRef("");
  const lastPriceRef = useRef("");
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          track("Calendar viewed", { house: property });
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [property]);
  function markUsed(how: string) {
    if (usedRef.current) return;
    usedRef.current = true;
    track("Calendar used", { house: property, how });
  }
  useEffect(() => {
    if (!stayOk || !checkIn || !checkOut || !verdict) return;
    const key = `${checkIn}|${checkOut}|${guests}`;
    if (key === lastStayRef.current) return;
    lastStayRef.current = key;
    const leadDays = Math.round((Date.parse(checkIn) - Date.parse(today)) / 86_400_000);
    track("Dates selected", {
      house: property,
      nights: verdict.nights,
      guests,
      month: checkIn.slice(0, 7),
      leadDays,
    });
  }, [stayOk, checkIn, checkOut, guests, verdict, property, today]);
  useEffect(() => {
    if (quoteState !== "ready" && quoteState !== "failed") return;
    const key = `${checkIn}|${checkOut}|${guests}|${quoteState}`;
    if (key === lastPriceRef.current) return;
    lastPriceRef.current = key;
    if (quoteState === "ready" && quote) {
      track("Price shown", { house: property, nights: quote.nights, guests, directTotal: Math.round(quote.directTotal) });
    } else {
      track("Price failed", { house: property });
    }
  }, [quoteState, quote, checkIn, checkOut, guests, property]);
  function continueClicked(place: string) {
    track("Continue to checkout", {
      house: property,
      place,
      nights: verdict?.nights ?? 0,
      guests,
      ...(quote ? { directTotal: Math.round(quote.directTotal) } : {}),
    });
  }

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
        if (quoteAttempt) params.set("retry", String(quoteAttempt));
        const response = await fetch(`/api/quote?${params}`, { signal: controller.signal });
        const data = (await response.json().catch(() => null)) as (QuoteResult & { error?: string }) | null;
        if (!response.ok || !data) {
          // e.g. 429 "Too many price checks": the body is { error }, not a QuoteResult.
          setQuote(null);
          setQuoteMessage(data?.error ?? "The price could not be loaded just now.");
          setQuoteState("failed");
          return;
        }
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
        setQuoteMessage("The comparison price could not be loaded just now.");
        setQuoteState("failed");
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [stayOk, checkIn, checkOut, guests, property, quoteAttempt]);
  const lastDay = days.at(-1)?.date ?? today;

  const second = cursor.month === 11
    ? { year: cursor.year + 1, month: 0 }
    : { year: cursor.year, month: cursor.month + 1 };

  function shift(amount: number) {
    markUsed("month");
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
    markUsed("date");
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


  return (
    <section id="stay" className="section stay-section" ref={sectionRef}>
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
          <div className="calendar-notes">
          <p className="sync-note">
            <i aria-hidden="true" />
            {sources.booking === "synced"
              ? "Live availability, synced with all our bookings"
              : sources.booking === "failed"
                ? "Live availability · part of the calendar didn’t respond, the host will double-check"
                : "Live availability, synced with all our bookings"}
          </p>
          {paymentsOn ? (
            <p className="calendar-secure">
              <Icon name="lock" size={15} /> Secure payment by Stripe · 3-D Secure
            </p>
          ) : null}
          </div>
        </div>

        </div>

        <aside className="stay-card">
          <p className="direct-badge">
            <span>−{DIRECT_DISCOUNT_LABEL}</span> Book direct and pay {DIRECT_DISCOUNT_LABEL} less than on booking platforms
          </p>
          <p className="stay-kicker">{kicker}</p>
          <div className="guest-row">
            <span>Guests</span>
            <div>
              <button type="button" onClick={() => setGuests((count) => Math.max(1, count - 1))} aria-label="Fewer guests">
                −
              </button>
              <strong>{guests}</strong>
              <button
                type="button"
                onClick={() => setGuests((count) => Math.min(maxGuests, count + 1))}
                aria-label="More guests"
                disabled={guests >= maxGuests}
              >
                +
              </button>
            </div>
          </div>
          {guests >= maxGuests ? <p className="guest-max">Maximum {maxGuests} guests for this house.</p> : null}
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
              {verdict?.ok ? (
                <PriceBox state={quoteState} quote={quote} message={quoteMessage} onRetry={() => setQuoteAttempt((n) => n + 1)} />
              ) : null}
              {verdict?.ok && checkIn && checkOut && quoteState !== "failed" ? (
                <>
                  <a
                    className="book-button reserve card-submit"
                    onClick={() => continueClicked("card")}
                    href={`/checkout?${new URLSearchParams({ property, checkIn, checkOut, guests: String(guests) })}`}
                  >
                    {quote ? `Continue to checkout · ${formatMoney(quote.directTotal)}` : "Continue to checkout"}
                  </a>
                  <p className="card-hint">
                    {paymentsOn
                      ? `Pay a ${DEPOSIT_LABEL} deposit at checkout; the rest on site, on arrival.`
                      : "At checkout you send your details; the host confirms by email and sends a secure payment link."}
                  </p>
                  {paymentsOn ? <SecurePay compact /> : null}
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
            <a href={verdict?.ok && checkIn && checkOut ? stayLink(airbnbUrl, checkIn, checkOut, guests, "airbnb") : airbnbUrl} target="_blank" rel="noreferrer">
              Book there
            </a>
          </p>
        </aside>
      </div>
      <div className={`mobile-bar${verdict?.ok && checkIn && checkOut ? " has-stay" : ""}`}>
        {verdict?.ok && checkIn && checkOut && quoteState !== "failed" ? (
          <>
            <span className="mobile-bar-price">
              <strong>{quote ? formatMoney(quote.directTotal) : quoteState === "loading" ? "…" : "Your stay"}</strong>
              <small>
                {verdict.nights} night{verdict.nights === 1 ? "" : "s"} · {guests} guest{guests === 1 ? "" : "s"}
                {quote?.savings ? ` · save ${formatMoney(quote.savings)}` : ""}
              </small>
            </span>
            <a
              onClick={() => continueClicked("mobile-bar")}
              href={`/checkout?${new URLSearchParams({ property, checkIn, checkOut, guests: String(guests) })}`}
            >
              Continue to checkout
            </a>
          </>
        ) : (
          <>
            <span className="mobile-bar-price">
              <strong>−{DIRECT_DISCOUNT_LABEL}</strong>
              <small>vs booking platforms when you book here</small>
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
              data-date={iso}
              aria-label={`${new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}${
                past ? "" : taken ? ", booked" : !day?.checkin && iso !== checkIn ? ", no check-in" : ", available"
              }${endpoint ? ", selected" : ""}`}
              aria-pressed={endpoint}
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

function PriceBox({
  state,
  quote,
  message,
  onRetry,
}: {
  state: "idle" | "loading" | "ready" | "failed";
  quote: StayQuote | null;
  message: string;
  onRetry: () => void;
}) {
  if (state === "loading") {
    return (
      <div className="price-box is-loading" aria-live="polite">
        <span className="price-skeleton" />
        <span className="price-skeleton short" />
        <p>Checking the price for these dates…</p>
      </div>
    );
  }
  if (state === "ready" && quote && quote.airbnbTotal === null) {
    return (
      <div className="price-box" aria-live="polite">
        <div className="price-row direct">
          <span>
            Booking direct
            <small>
              {quote.nights} night{quote.nights === 1 ? "" : "s"} · about {formatMoney(quote.perNight)} a night
            </small>
          </span>
          <strong>{formatMoney(quote.directTotal)}</strong>
        </div>
      </div>
    );
  }
  if (state === "ready" && quote) {
    return (
      <div className="price-box" aria-live="polite">
        <div className="price-row airbnb">
          <span>On booking platforms</span>
          <s>{formatMoney(quote.airbnbTotal ?? 0)}</s>
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
          You save <b>{formatMoney(quote.savings ?? 0)}</b> ({DIRECT_DISCOUNT_LABEL}) compared with booking platforms for the same dates.
        </p>
      </div>
    );
  }
  if (state === "failed") {
    return (
      <div className="price-box is-failed" aria-live="polite">
        <p>{message} Without today’s price you can’t book online yet; please try again in a moment.</p>
        <button type="button" className="button ghost price-retry" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  return null;
}
