"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { BookingListing, CalendarDay } from "@/lib/listings";
import { stayLink, type PropertyId } from "@/lib/properties";
import { evaluateStay, formatLong, monthGrid, monthLabel } from "@/lib/stay";

type Props = {
  property: PropertyId;
  maxGuests: number;
  defaultGuests: number;
  kicker: string;
  finePrint: string;
  airbnbUrl: string;
  bookingUrl: string | null;
  intro: string;
  initialDays: CalendarDay[];
  initialError: string | null;
  booking: BookingListing | null;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Availability({
  property,
  maxGuests,
  defaultGuests,
  kicker,
  finePrint,
  airbnbUrl,
  bookingUrl,
  intro,
  initialDays,
  initialError,
  booking,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date();
  const [cursor, setCursor] = useState({ year: start.getFullYear(), month: start.getMonth() });
  const [days, setDays] = useState(initialDays);
  const [error, setError] = useState(initialError);
  const [bookingState, setBookingState] = useState(booking);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guests, setGuests] = useState(defaultGuests);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    setConfirmation(null);
    setReserveError(null);
  }, [checkIn, checkOut]);

  const byDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const verdict = checkIn && checkOut ? evaluateStay(days, checkIn, checkOut) : null;
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
        booking: BookingListing;
      };
      setDays(data.days);
      setError(data.error);
      setBookingState(data.booking);
    } catch {
      setError("The calendars could not be refreshed. Try again in a moment.");
    } finally {
      setRefreshing(false);
    }
  }

  async function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verdict?.ok || !checkIn || !checkOut) return;
    setSending(true);
    setReserveError(null);
    try {
      const response = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property, checkIn, checkOut, guests, name, email, phone, note }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        setReserveError(data.error ?? "The reservation could not be saved.");
        return;
      }
      setConfirmation(data.id);
      const fresh = await fetch(`/api/availability?property=${property}`);
      if (fresh.ok) {
        const calendar = (await fresh.json()) as { days: CalendarDay[]; error: string | null; booking: BookingListing };
        setDays(calendar.days);
        setError(calendar.error);
        setBookingState(calendar.booking);
      }
    } catch {
      setReserveError("The reservation could not be sent. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  const airbnbHref =
    checkIn && checkOut ? stayLink(airbnbUrl, checkIn, checkOut, guests, "airbnb") : airbnbUrl;
  const bookingHref =
    bookingUrl && checkIn && checkOut
      ? stayLink(bookingUrl, checkIn, checkOut, guests, "booking")
      : bookingUrl;

  return (
    <section id="stay" className="section stay-section">
      <div className="section-head">
        <p className="eyebrow">Live dates</p>
        <h2>See what is free, then book where you prefer</h2>
        <p>{intro}</p>
      </div>

      <div className="stay-layout">
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
            <li><i className="swatch free" /> Open on Airbnb</li>
            <li><i className="swatch taken" /> Booked on Airbnb</li>
            <li><i className="swatch chosen" /> Your stay</li>
          </ul>
        </div>

        <aside className="stay-card">
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
          {confirmation ? (
            <div className="reserve-done">
              <strong>{confirmation}</strong>
              <p>Your request is saved. The host will confirm these dates with you.</p>
            </div>
          ) : (
            <>
              <p className={`verdict ${verdict?.ok ? "is-ok" : ""}`}>
                {verdict?.message ?? "Click an arrival date, then a departure date. Minimum stays vary by week."}
              </p>
              {verdict?.ok ? (
                <form className="reserve-form" onSubmit={reserve}>
                  <label>
                    Name
                    <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
                  </label>
                  <label>
                    Email
                    <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
                  </label>
                  <label>
                    Phone
                    <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" />
                  </label>
                  <label>
                    Note
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} />
                  </label>
                  {reserveError ? <p className="reserve-error">{reserveError}</p> : null}
                  <button className="book-button reserve" type="submit" disabled={sending}>
                    {sending ? "Sending…" : "Reserve these dates"}
                  </button>
                </form>
              ) : (
                <button className="book-button reserve is-disabled" type="button" disabled>
                  Reserve these dates
                </button>
              )}
            </>
          )}
          <a
            className="book-button airbnb"
            href={verdict?.ok ? airbnbHref : airbnbUrl}
            target="_blank"
            rel="noreferrer"
          >
            Book on Airbnb instead
          </a>
          {bookingHref && bookingState ? (
            <>
              <a className="book-button booking" href={bookingHref} target="_blank" rel="noreferrer">
                {bookingState.state === "open" ? "Book on Booking.com" : "Open on Booking.com"}
              </a>
              <BookingNote
                state={bookingState.state}
                reviewCount={bookingState.reviewCount}
                scoreLabel={bookingState.scoreLabel}
              />
            </>
          ) : null}
          <p className="fine-print">{finePrint}</p>
        </aside>
      </div>
    </section>
  );
}

function BookingNote({
  state,
  reviewCount,
  scoreLabel,
}: {
  state: BookingListing["state"];
  reviewCount: number;
  scoreLabel: string;
}) {
  if (state === "open") {
    return (
      <p className="platform-note">
        Booking.com is accepting stays and shows {scoreLabel.toLowerCase()} from {reviewCount} reviews. The price is
        confirmed on their page.
      </p>
    );
  }
  if (state === "closed") {
    return (
      <p className="platform-note">
        Booking.com still shows an Exceptional score from {reviewCount} reviews, but the listing page currently
        redirects as closed, so it has no nights to book. Airbnb is the live calendar.
      </p>
    );
  }
  return (
    <p className="platform-note">
      Booking.com publishes {scoreLabel.toLowerCase()} from {reviewCount} reviews. Their page did not confirm
      availability just now, so open it with your dates to check.
    </p>
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
