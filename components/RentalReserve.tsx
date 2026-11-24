"use client";

import { useState, type FormEvent } from "react";
import { formatMoney } from "@/lib/pricing";
import {
  EQUIPMENT,
  EQUIPMENT_GROUPS,
  LESSON_KINDS,
  SCHOOL,
  SEASON_LABEL,
  seasonRanges,
  type EquipmentGroup,
  type LessonKind,
  type PriceRow,
  type RentalLine,
  type Season,
} from "@/lib/rentals";
import { formatLong } from "@/lib/stay";
import { track } from "@/lib/track";
import { RentalPicker } from "./RentalPicker";

const VIA = ["Airbnb", "Booking.com", "Directly with Frosina", "This website", "Other"];

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * The form on /ski-rental: guests who booked on Airbnb, Booking.com or by phone
 * reserve equipment or lessons here. Nothing is paid; the reservation goes to Frosina as a PDF.
 */
export function RentalReserve() {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("");
  const [bookedVia, setBookedVia] = useState(VIA[0]);
  const [bookingRef, setBookingRef] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [lines, setLines] = useState<RentalLine[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentRef, setSentRef] = useState<string | null>(null);

  const datesOk = Boolean(checkIn && checkOut && checkOut > checkIn);
  const skiFrom = checkIn ? addDays(checkIn, 1) : addDays(today, 1);
  const skiDays = datesOk ? Math.max(1, nightsBetween(checkIn, checkOut) - 1) : 5;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines.length) {
      setError("Add at least one item of equipment or ski school.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/rental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, checkIn, checkOut, guests: Number(guests) || undefined, bookedVia, bookingRef, note, lines, website }),
      });
      const data = (await response.json()) as { ok?: boolean; ref?: string; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "The reservation could not be sent.");
        return;
      }
      track("Rental reservation sent", { lines: lines.length, via: bookedVia });
      setSentRef(data.ref ?? "");
    } catch {
      setError("The reservation could not be sent. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rental-body">
      {sentRef !== null ? (
        <div className="checkout-card rental-done">
          <h3>Reservation sent</h3>
          <p>
            Frosina has your reservation{sentRef ? (
              <>
                {" "}
                <b>{sentRef}</b>
              </>
            ) : null}{" "}
            and will pass it to the shop. A copy is on its way to {email}. Nothing has been paid.
          </p>
          <a className="button primary" href="/villa-kaja">
            Back to Villa Kaja
          </a>
        </div>
      ) : (
        <form className="checkout-card checkout-form rental-form" onSubmit={submit}>
          <h3>Your stay at Villa Kaja</h3>
          <div className="details-grid">
            <label>
              <span>Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={120} />
            </label>
            <label>
              <span>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required maxLength={160} />
            </label>
            <label>
              <span>Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" required maxLength={40} placeholder="+359 …" />
            </label>
            <label>
              <span>Booked via</span>
              <select value={bookedVia} onChange={(e) => setBookedVia(e.target.value)}>
                {VIA.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Check-in</span>
              <input
                type="date"
                value={checkIn}
                min={today}
                onChange={(e) => {
                  const next = e.target.value;
                  // Lines still on the old default first day follow the new check-in.
                  if (next) setLines((all) => all.map((l) => (l.from === skiFrom ? { ...l, from: addDays(next, 1) } : l)));
                  setCheckIn(next);
                }}
                required
              />
            </label>
            <label>
              <span>Check-out</span>
              <input type="date" value={checkOut} min={checkIn || today} onChange={(e) => setCheckOut(e.target.value)} required />
            </label>
            <label>
              <span>
                Guests <small>optional</small>
              </span>
              <input type="number" inputMode="numeric" min={1} max={30} value={guests} onChange={(e) => setGuests(e.target.value)} />
            </label>
            <label>
              <span>
                Booking reference <small>optional</small>
              </span>
              <input value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} maxLength={60} placeholder="e.g. HMXXXXXX" />
            </label>
          </div>

          <h3>What to reserve</h3>
          <p className="reserve-only-line">
            <span className="reserve-only">Reserve only · nothing to pay now</span> You pay the shop in Bansko.
          </p>
          <RentalPicker
            lines={lines}
            onChange={setLines}
            defaultFrom={skiFrom}
            defaultDays={skiDays}
            defaultPeople={Number(guests) || 1}
            minDate={today}
          />

          <div className="details-grid">
            <label className="wide">
              <span>
                Note <small>optional</small>
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={600}
                placeholder="Heights, shoe sizes, ski level, children’s ages…"
              />
            </label>
          </div>

          <label className="hp-field" aria-hidden="true">
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>

          {error ? <p className="reserve-error">{error}</p> : null}
          <button className="book-button reserve checkout-pay" type="submit" disabled={sending}>
            {sending ? "Sending…" : "Send reservation to Frosina · pay at the shop"}
          </button>
          <p className="checkout-fine">Nothing is charged. You get a copy of the reservation by email.</p>
        </form>
      )}

      <details className="rental-prices">
        <summary>See the full 2026/27 price list</summary>
        <PriceTables />
      </details>
    </div>
  );
}

const DAY_HEADS = ["1 day", "2 days", "3 days", "4 days", "5 days", "6 days", "Extra day"];

function cells(row: PriceRow, free = false) {
  return row.map((n, i) => <td key={i}>{free ? "Free" : `${i === 6 ? "+" : ""}${formatMoney(n)}`}</td>);
}

function PriceTables() {
  return (
    <div className="rental-tables">
      <h4>Equipment rental</h4>
      {(Object.keys(EQUIPMENT_GROUPS) as EquipmentGroup[]).map((group) => (
        <div className="rental-table-wrap" key={group}>
          <table>
            <caption>{EQUIPMENT_GROUPS[group]}</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                {DAY_HEADS.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.values(EQUIPMENT)
                .filter((item) => item.group === group)
                .map((item) => (
                  <tr key={item.name}>
                    <th scope="row">{item.name}</th>
                    {cells(item.prices, item.prices[0] === 0)}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
      <h4>Ski school</h4>
      {(["low", "high"] as Season[]).map((season) => (
        <div className="rental-table-wrap" key={season}>
          <table>
            <caption>
              {SEASON_LABEL[season]} ({seasonRanges(season).map((r) => `${formatLong(r.from)} – ${formatLong(r.to)}`).join("; ")})
            </caption>
            <thead>
              <tr>
                <th scope="col">Lessons</th>
                {DAY_HEADS.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(LESSON_KINDS) as LessonKind[]).flatMap((kind) =>
                ([2, 4] as const).map((hours) => {
                  const rate = SCHOOL[season][kind][hours];
                  return (
                    <tr key={`${kind}-${hours}`}>
                      <th scope="row">
                        {LESSON_KINDS[kind].name.replace(" lessons", "")}, {hours} h
                        {rate.extra ? <small> 2 people, +{formatMoney(rate.extra)} per extra person a day</small> : null}
                      </th>
                      {cells(rate.prices)}
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      ))}
      <p className="checkout-fine">Group and one-to-one prices are per person. Prices in euro, paid at the shop.</p>
    </div>
  );
}
