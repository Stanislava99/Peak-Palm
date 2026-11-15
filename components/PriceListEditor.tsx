"use client";

import { useMemo, useState } from "react";
import { extraGuestsFor, minimumNights, nightlyPrice, priceFromList, type PriceList } from "@/lib/price-math";

type House = "kaja" | "janis";
type HouseInfo = { id: House; name: string; maxGuests: number };

const euro = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
const day = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

async function send(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Sorry, that didn’t save. Please try again.");
  return data.message ?? "Saved.";
}

/**
 * Admin → Prices. Standard prices per house (with extra-guest pricing), special dates,
 * a month price calendar and a "try a stay" calculator. All amounts are what guests pay here.
 */
export function PriceListEditor({
  list,
  houses,
  taken,
  today,
}: {
  list: PriceList;
  houses: HouseInfo[];
  /** Nights already taken (Airbnb, Booking.com, direct), per house. */
  taken: Record<House, string[]>;
  today: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(key: string, body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setNote(null);
    try {
      const message = await send(body);
      setNote({ ok: true, text: message });
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setNote({ ok: false, text: (error as Error).message });
      setBusy(null);
    }
  }

  return (
    <div className="price-admin">
      {note ? (
        <p className={`price-note ${note.ok ? "is-ok" : "is-bad"}`} role="status">
          {note.text}
        </p>
      ) : null}

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>Standard prices</h2>
        </div>
        <p className="adm-sub">These apply to every night that isn’t covered by a special date below.</p>
        <div className="price-houses">
          {houses.map((house) => (
            <StandardPrices key={house.id} house={house} list={list} busy={busy} onSave={(body) => run(`defaults-${house.id}`, body)} />
          ))}
        </div>
      </section>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>Special dates</h2>
        </div>
        <p className="adm-sub">
          A different price per night for a period, such as Christmas, ski weeks or August. Choose the first and the last <b>night</b> of the period (the
          day guests leave isn’t a night). Extra guests and the cleaning fee are added as usual. If two periods overlap, the one added last is used.
        </p>
        <PeriodForm houses={houses} today={today} busy={busy} onAdd={(body) => run("add", body)} />
        <PeriodList list={list} houses={houses} today={today} busy={busy} onDelete={(id) => run(`del-${id}`, { action: "delete-period", id }, "Remove this special price? Those nights go back to the standard price.")} />
      </section>

      <PriceCalendar list={list} houses={houses} taken={taken} today={today} />
      <TryAStay list={list} houses={houses} today={today} />
    </div>
  );
}

/* ── Standard prices per house ───────────────────────────── */

function StandardPrices({
  house,
  list,
  busy,
  onSave,
}: {
  house: HouseInfo;
  list: PriceList;
  busy: string | null;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const d = list.defaults[house.id];
  const [nightly, setNightly] = useState(d.nightly?.toString() ?? "");
  const [included, setIncluded] = useState(d.includedGuests?.toString() ?? "");
  const [extra, setExtra] = useState(d.extraGuest ? d.extraGuest.toString() : "");
  const [cleaning, setCleaning] = useState(d.cleaning ? d.cleaning.toString() : "");
  const [minNights, setMinNights] = useState(String(d.minNights || 1));

  const example = useMemo(() => {
    const n = Number(nightly);
    if (!(n > 0)) return null;
    const inc = Number(included) || null;
    const ex = Number(extra) || 0;
    const nights = Math.max(Number(minNights) || 1, 3);
    const guests = house.maxGuests;
    const extraGuests = inc && ex ? Math.max(0, guests - inc) : 0;
    const total = n * nights + extraGuests * ex * nights + (Number(cleaning) || 0);
    return { nights, guests, total, extraGuests };
  }, [nightly, included, extra, cleaning, minNights, house.maxGuests]);

  return (
    <form
      className="price-house"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ action: "defaults", property: house.id, nightly, includedGuests: included, extraGuest: extra, cleaning, minNights });
      }}
    >
      <h3>
        {house.name} <small>sleeps {house.maxGuests}</small>
      </h3>
      <div className="price-fields">
        <label>
          <span>Price per night</span>
          <span className="price-input">
            <i>€</i>
            <input value={nightly} onChange={(e) => setNightly(e.target.value)} type="number" inputMode="decimal" min="1" step="0.01" placeholder="e.g. 450" />
          </span>
        </label>
        <label>
          <span>…covers up to</span>
          <span className="price-input">
            <input value={included} onChange={(e) => setIncluded(e.target.value)} type="number" inputMode="numeric" min="1" max={house.maxGuests} step="1" placeholder={String(house.maxGuests)} />
            <i>guests</i>
          </span>
        </label>
        <label>
          <span>Each extra guest, per night</span>
          <span className="price-input">
            <i>€</i>
            <input value={extra} onChange={(e) => setExtra(e.target.value)} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" />
          </span>
        </label>
        <label>
          <span>Cleaning fee, per stay</span>
          <span className="price-input">
            <i>€</i>
            <input value={cleaning} onChange={(e) => setCleaning(e.target.value)} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" />
          </span>
        </label>
        <label>
          <span>Minimum stay</span>
          <span className="price-input">
            <input value={minNights} onChange={(e) => setMinNights(e.target.value)} type="number" inputMode="numeric" min="1" max="60" step="1" />
            <i>nights</i>
          </span>
        </label>
      </div>
      <p className="price-example">
        {example ? (
          <>
            For example, {example.nights} nights for {example.guests} guests
            {example.extraGuests ? ` (${example.extraGuests} extra)` : ""}: <b>{euro(example.total)}</b>
          </>
        ) : (
          "Leave the price per night empty if you don’t want a standard price. Nights without a price can’t be booked online when Airbnb doesn’t answer."
        )}
      </p>
      <button className="button primary" type="submit" disabled={Boolean(busy)}>
        {busy === `defaults-${house.id}` ? "Saving…" : `Save ${house.name}`}
      </button>
    </form>
  );
}

/* ── Special dates ───────────────────────────────────────── */

function PeriodForm({ houses, today, busy, onAdd }: { houses: HouseInfo[]; today: string; busy: string | null; onAdd: (body: Record<string, unknown>) => void }) {
  const [from, setFrom] = useState("");
  return (
    <form
      className="price-period-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onAdd({
          action: "add-period",
          property: form.get("property"),
          from: form.get("from"),
          to: form.get("to"),
          nightly: form.get("nightly"),
          minNights: form.get("minNights"),
          label: form.get("label"),
        });
      }}
    >
      <label>
        <span>House</span>
        <select name="property" defaultValue={houses[0]?.id}>
          {houses.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>First night</span>
        <input name="from" type="date" min={today} required value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label>
        <span>Last night</span>
        <input name="to" type="date" min={from || today} required />
      </label>
      <label>
        <span>Price per night</span>
        <span className="price-input">
          <i>€</i>
          <input name="nightly" type="number" inputMode="decimal" min="1" step="0.01" required placeholder="e.g. 650" />
        </span>
      </label>
      <label>
        <span>Minimum stay (optional)</span>
        <span className="price-input">
          <input name="minNights" type="number" inputMode="numeric" min="1" max="60" step="1" placeholder="standard" />
          <i>nights</i>
        </span>
      </label>
      <label className="is-wide">
        <span>Name (optional)</span>
        <input name="label" type="text" maxLength={60} placeholder="e.g. Christmas & New Year" />
      </label>
      <button className="button primary" type="submit" disabled={Boolean(busy)}>
        {busy === "add" ? "Adding…" : "Add special price"}
      </button>
    </form>
  );
}

function PeriodList({
  list,
  houses,
  today,
  busy,
  onDelete,
}: {
  list: PriceList;
  houses: HouseInfo[];
  today: string;
  busy: string | null;
  onDelete: (id: number) => void;
}) {
  const periods = [...list.periods].sort((a, b) => a.from.localeCompare(b.from));
  if (!periods.length) return <p className="price-empty">No special dates yet. Every night uses the standard price.</p>;
  return (
    <ul className="price-periods">
      {periods.map((p) => {
        const nights = Math.round((Date.parse(p.to) - Date.parse(p.from)) / 86_400_000) + 1;
        return (
          <li key={p.id} className={p.to < today ? "is-past" : ""}>
            <span className={`price-dot is-${p.property}`} aria-hidden />
            <div>
              <b>{p.label || "Special price"}</b>
              <small>
                {houses.find((h) => h.id === p.property)?.name} · {day(p.from)} – {day(p.to)} · {nights} night{nights === 1 ? "" : "s"}
                {p.minNights ? ` · minimum ${p.minNights} nights` : ""}
                {p.to < today ? " · past" : ""}
              </small>
            </div>
            <strong>
              {euro(p.nightly)}
              <small>/night</small>
            </strong>
            <button className="adm-btn" type="button" disabled={Boolean(busy)} onClick={() => onDelete(p.id)}>
              {busy === `del-${p.id}` ? "Removing…" : "Remove"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Price calendar ──────────────────────────────────────── */

function PriceCalendar({ list, houses, taken, today }: { list: PriceList; houses: HouseInfo[]; taken: Record<House, string[]>; today: string }) {
  const [house, setHouse] = useState<House>(houses[0]?.id ?? "kaja");
  const [month, setMonth] = useState(today.slice(0, 7));
  const info = houses.find((h) => h.id === house)!;
  const defaults = list.defaults[house];
  const [guests, setGuests] = useState(info.maxGuests);
  const takenSet = useMemo(() => new Set(taken[house] ?? []), [taken, house]);

  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday first
  const shift = (by: number) => {
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const extra = extraGuestsFor(defaults, Math.min(guests, info.maxGuests)) * (defaults.extraGuest || 0);

  return (
    <section className="adm-card">
      <div className="adm-card-head">
        <h2>Price calendar</h2>
        <div className="price-cal-tools">
          <div className="adm-seg" role="tablist" aria-label="House">
            {houses.map((h) => (
              <a
                key={h.id}
                href="#price-calendar"
                role="tab"
                aria-current={house === h.id ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setHouse(h.id);
                  setGuests(h.maxGuests);
                }}
              >
                {h.name}
              </a>
            ))}
          </div>
          <label className="price-guests">
            <span>Price for</span>
            <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
              {Array.from({ length: info.maxGuests }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} guest{n === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <p className="adm-sub" id="price-calendar">
        What one night costs guests booking on the site when Airbnb doesn’t answer (cleaning fee not included). Taken nights are shaded.
      </p>
      <div className="price-cal-nav">
        <button className="adm-btn" type="button" onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <b>{day(first, { month: "long", year: "numeric" })}</b>
        <button className="adm-btn" type="button" onClick={() => shift(1)} aria-label="Next month">
          ›
        </button>
        <button className="adm-btn" type="button" onClick={() => setMonth(today.slice(0, 7))}>
          This month
        </button>
      </div>
      <div className="price-cal" role="grid" aria-label={`Prices for ${info.name}, ${day(first, { month: "long", year: "numeric" })}`}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
          <span key={w} className="price-cal-head" role="columnheader">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} className="price-cal-blank" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const { price, period } = nightlyPrice(list, house, date);
          const min = minimumNights(list, house, date);
          const isTaken = takenSet.has(date);
          const past = date < today;
          return (
            <div
              key={date}
              role="gridcell"
              className={`price-cal-day${period ? " is-special" : ""}${isTaken ? " is-taken" : ""}${past ? " is-past" : ""}${price === null ? " is-unpriced" : ""}${date === today ? " is-today" : ""}`}
              title={`${day(date, { weekday: "long", day: "numeric", month: "long" })}${period ? ` · ${period.label || "special price"}` : ""}${isTaken ? " · taken" : ""}`}
            >
              <span className="price-cal-num">{i + 1}</span>
              <strong>{price === null ? "—" : euro(price + extra)}</strong>
              <small>
                {isTaken ? "taken" : period?.label ? period.label : min > 1 ? `min ${min}` : " "}
              </small>
            </div>
          );
        })}
      </div>
      <p className="price-cal-legend">
        <span>
          <i className="is-special" /> Special price
        </span>
        <span>
          <i className="is-taken" /> Taken (Airbnb, Booking.com or direct)
        </span>
        <span>— No price set</span>
      </p>
    </section>
  );
}

/* ── Try a stay ──────────────────────────────────────────── */

function TryAStay({ list, houses, today }: { list: PriceList; houses: HouseInfo[]; today: string }) {
  const [house, setHouse] = useState<House>(houses[0]?.id ?? "kaja");
  const [checkIn, setCheckIn] = useState(addDays(today, 30));
  const [checkOut, setCheckOut] = useState(addDays(today, 37));
  const info = houses.find((h) => h.id === house)!;
  const [guests, setGuests] = useState(Math.min(8, info.maxGuests));
  const priced = checkOut > checkIn ? priceFromList(list, house, checkIn, checkOut, Math.min(guests, info.maxGuests)) : null;
  const min = minimumNights(list, house, checkIn);

  return (
    <section className="adm-card">
      <div className="adm-card-head">
        <h2>Try a stay</h2>
      </div>
      <p className="adm-sub">Check what a guest would pay with your prices. Nothing is booked or saved.</p>
      <div className="price-try">
        <label>
          <span>House</span>
          <select
            value={house}
            onChange={(e) => {
              const next = e.target.value as House;
              setHouse(next);
              setGuests((g) => Math.min(g, houses.find((h) => h.id === next)!.maxGuests));
            }}
          >
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Check-in</span>
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </label>
        <label>
          <span>Check-out</span>
          <input type="date" value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} />
        </label>
        <label>
          <span>Guests</span>
          <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
            {Array.from({ length: info.maxGuests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      {priced ? (
        <div className="price-try-result">
          <dl>
            <div>
              <dt>
                {priced.nights} night{priced.nights === 1 ? "" : "s"}
              </dt>
              <dd>{euro(priced.nightsTotal)}</dd>
            </div>
            {priced.extraTotal ? (
              <div>
                <dt>
                  {priced.extraGuests} extra guest{priced.extraGuests === 1 ? "" : "s"} × {euro(priced.extraGuestRate)} × {priced.nights} night
                  {priced.nights === 1 ? "" : "s"}
                </dt>
                <dd>{euro(priced.extraTotal)}</dd>
              </div>
            ) : null}
            {priced.cleaning ? (
              <div>
                <dt>Cleaning fee</dt>
                <dd>{euro(priced.cleaning)}</dd>
              </div>
            ) : null}
            <div className="is-total">
              <dt>Guest pays</dt>
              <dd>{euro(priced.total)}</dd>
            </div>
            <div>
              <dt>Deposit now (50%) · rest on arrival</dt>
              <dd>
                {euro(Math.round(priced.total / 2))} · {euro(priced.total - Math.round(priced.total / 2))}
              </dd>
            </div>
          </dl>
          {priced.nights < min ? <p className="price-warn">Stays starting on this day need at least {min} nights, so the site wouldn’t accept this one.</p> : null}
        </div>
      ) : (
        <p className="price-empty">{checkOut > checkIn ? "Some of these nights have no price yet, so guests would see “no price”." : "Choose a check-out after the check-in."}</p>
      )}
    </section>
  );
}
