"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
 * Admin → Prices, laid out like Airbnb's pricing calendar: a month calendar per house with a side panel.
 * Nothing selected → the house's standard prices; nights selected → set a price for just those nights.
 * Below: the list of special prices and a "try a stay" calculator. All amounts are what guests pay here.
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
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  /** Saves, then refreshes the prices in place (the calendar keeps its month and house). */
  async function run(key: string, body: Record<string, unknown>, confirmText?: string): Promise<boolean> {
    if (confirmText && !window.confirm(confirmText)) return false;
    setBusy(key);
    setNote(null);
    try {
      const message = await send(body);
      setNote({ ok: true, text: message });
      router.refresh();
      return true;
    } catch (error) {
      setNote({ ok: false, text: (error as Error).message });
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="price-admin">
      <PriceCalendar list={list} houses={houses} taken={taken} today={today} busy={busy} note={note} run={run} />

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>Special prices</h2>
        </div>
        <p className="adm-sub">Every price you set on the calendar for chosen nights. Extra guests and the cleaning fee are added to these as usual.</p>
        <PeriodList
          list={list}
          houses={houses}
          today={today}
          busy={busy}
          onDelete={(id) => run(`del-${id}`, { action: "delete-period", id }, "Remove this special price? Those nights go back to the standard price.")}
        />
      </section>

      <TryAStay list={list} houses={houses} today={today} />
    </div>
  );
}

type Run = (key: string, body: Record<string, unknown>, confirmText?: string) => Promise<boolean>;

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
        Standard prices <small>{house.name} · sleeps {house.maxGuests}</small>
      </h3>
      <p className="price-panel-hint">For every night without a special price. To change some nights only, tap them on the calendar.</p>
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

/* ── Special prices list ─────────────────────────────────── */

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

/* ── Price calendar (Airbnb-style) ── */

type Note = { ok: boolean; text: string } | null;

function PriceCalendar({
  list,
  houses,
  taken,
  today,
  busy,
  note,
  run,
}: {
  list: PriceList;
  houses: HouseInfo[];
  taken: Record<House, string[]>;
  today: string;
  busy: string | null;
  note: Note;
  run: Run;
}) {
  const [house, setHouse] = useState<House>(houses[0]?.id ?? "kaja");
  const [month, setMonth] = useState(today.slice(0, 7));
  const info = houses.find((h) => h.id === house)!;
  const defaults = list.defaults[house];
  const [guests, setGuests] = useState(info.maxGuests);
  const takenSet = useMemo(() => new Set(taken[house] ?? []), [taken, house]);

  // Selection: first tap = first night, second tap = last night, third tap starts again.
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const clear = () => {
    setStart(null);
    setEnd(null);
    setHover(null);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && clear();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const lastNight = end ?? (start && hover && hover > start ? hover : start);
  const inRange = (date: string) => Boolean(start && lastNight && date >= start && date <= lastNight);

  function pick(date: string) {
    if (!start || end) {
      setStart(date);
      setEnd(null);
    } else if (date < start) {
      setStart(date);
    } else {
      setEnd(date);
      // On phones the panel sits under the calendar: bring it into view.
      if (window.matchMedia("(max-width: 960px)").matches) {
        window.setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    }
  }

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
    <section className="adm-card price-editor-card">
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
                  clear();
                }}
              >
                {h.name}
              </a>
            ))}
          </div>
          <label className="price-guests">
            <span>Show prices for</span>
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
        Tap the first and the last <b>night</b> to change their price (the day guests leave isn’t a night). Prices are per night for {guests} guest
        {guests === 1 ? "" : "s"}, without the cleaning fee. They’re used when Airbnb doesn’t give a price.
      </p>

      {note && (!start || !note.ok) ? (
        <p className={`price-note ${note.ok ? "is-ok" : "is-bad"}`} role="status">
          {note.text}
        </p>
      ) : null}

      <div className="price-editor">
        <div className="price-editor-cal">
          <div className="price-cal-nav">
            <button className="adm-btn" type="button" onClick={() => shift(-1)} aria-label="Previous month">
              ‹
            </button>
            <b>{day(first, { month: "long", year: "numeric" })}</b>
            <button className="adm-btn" type="button" onClick={() => shift(1)} aria-label="Next month">
              ›
            </button>
            {month !== today.slice(0, 7) ? (
              <button className="adm-btn" type="button" onClick={() => setMonth(today.slice(0, 7))}>
                Today
              </button>
            ) : null}
          </div>
          <div className="price-cal" role="grid" aria-label={`Prices for ${info.name}, ${day(first, { month: "long", year: "numeric" })}`} onMouseLeave={() => setHover(null)}>
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
              const selected = inRange(date);
              const cls = [
                "price-cal-day",
                period ? "is-special" : "",
                isTaken ? "is-taken" : "",
                past ? "is-past" : "",
                price === null ? "is-unpriced" : "",
                date === today ? "is-today" : "",
                selected ? "is-selected" : "",
                selected && date === start ? "is-first" : "",
                selected && date === lastNight ? "is-last" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  data-date={date}
                  className={cls}
                  disabled={past}
                  aria-pressed={selected}
                  aria-label={`${day(date, { weekday: "long", day: "numeric", month: "long" })}: ${price === null ? "no price" : euro(price + extra)}${period ? `, ${period.label || "special price"}` : ""}${isTaken ? ", taken" : ""}`}
                  onClick={() => pick(date)}
                  onMouseEnter={() => setHover(date)}
                >
                  <span className="price-cal-num">{i + 1}</span>
                  <strong>{price === null ? "—" : euro(price + extra)}</strong>
                  <small>{isTaken ? "taken" : period?.label ? period.label : min > 1 ? `min ${min}` : " "}</small>
                </button>
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
            <span>— No price yet</span>
          </p>
        </div>

        <div className="price-panel" ref={panelRef}>
          {start ? (
            <SelectedNights
              key={`${house}-${start}-${end ?? ""}`}
              house={info}
              list={list}
              from={start}
              to={end ?? start}
              chosenBoth={Boolean(end)}
              takenSet={takenSet}
              guests={guests}
              busy={busy}
              onCancel={clear}
              run={async (key, body, confirmText) => {
                const ok = await run(key, body, confirmText);
                if (ok) clear();
                return ok;
              }}
            />
          ) : (
            <StandardPrices key={house} house={info} list={list} busy={busy} onSave={(body) => run(`defaults-${house}`, body)} />
          )}
        </div>
      </div>
    </section>
  );
}

/** Side panel when nights are selected: one price (and optional minimum stay / name) for just those nights. */
function SelectedNights({
  house,
  list,
  from,
  to,
  chosenBoth,
  takenSet,
  guests,
  busy,
  onCancel,
  run,
}: {
  house: HouseInfo;
  list: PriceList;
  from: string;
  to: string;
  chosenBoth: boolean;
  takenSet: Set<string>;
  guests: number;
  busy: string | null;
  onCancel: () => void;
  run: Run;
}) {
  const nights = useMemo(() => {
    const out: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
  }, [from, to]);
  const prices = nights.map((n) => nightlyPrice(list, house.id, n));
  const known = prices.map((p) => p.price).filter((p): p is number => p !== null);
  const low = known.length ? Math.min(...known) : null;
  const high = known.length ? Math.max(...known) : null;
  const periods = [...new Map(prices.filter((p) => p.period).map((p) => [p.period!.id, p.period!])).values()];
  const takenCount = nights.filter((n) => takenSet.has(n)).length;
  const sameMin = new Set(nights.map((n) => minimumNights(list, house.id, n)));

  const [nightly, setNightly] = useState(low !== null && low === high && known.length === nights.length ? String(low) : "");
  // Pre-fill name and minimum only when every chosen night belongs to the same special price.
  const whole = periods.length === 1 && prices.every((p) => p.period?.id === periods[0].id) ? periods[0] : null;
  const [minNights, setMinNights] = useState(whole?.minNights ? String(whole.minNights) : "");
  const [label, setLabel] = useState(whole?.label ?? "");

  const defaults = list.defaults[house.id];
  const extraGuests = extraGuestsFor(defaults, guests);
  const n = Number(nightly);
  const count = nights.length;
  const range = count === 1 ? day(from, { weekday: "short", day: "numeric", month: "short" }) : `${day(from, { day: "numeric", month: "short" })} – ${day(to, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <form
      className="price-selected"
      onSubmit={(event) => {
        event.preventDefault();
        void run("range", { action: "set-range", property: house.id, from, to, nightly, minNights, label });
      }}
    >
      <div className="price-selected-head">
        <h3>{range}</h3>
        <button type="button" className="price-x" onClick={onCancel} aria-label="Clear selection">
          ×
        </button>
      </div>
      <p className="price-selected-meta">
        {count} night{count === 1 ? "" : "s"} · {house.name}
        {low !== null ? ` · now ${low === high ? euro(low) : `${euro(low)}–${euro(high!)}`} a night` : " · no price yet"}
      </p>
      {!chosenBoth ? <p className="price-panel-hint">Tap another day to choose more nights, or set a price for this one.</p> : null}
      {periods.length ? (
        <p className="price-panel-hint">
          Includes {periods.map((p) => `“${p.label || "special price"}”`).join(", ")}. Saving replaces those prices on these nights only.
        </p>
      ) : null}
      {takenCount ? (
        <p className="price-panel-hint">
          {takenCount} of these nights {takenCount === 1 ? "is" : "are"} already taken. Guests who booked keep their price.
        </p>
      ) : null}

      <label>
        <span>Price per night</span>
        <span className="price-input">
          <i>€</i>
          <input value={nightly} onChange={(e) => setNightly(e.target.value)} type="number" inputMode="decimal" min="1" step="0.01" required placeholder="e.g. 650" autoFocus={chosenBoth} />
        </span>
        {defaults.includedGuests ? (
          <small className="price-field-note">
            For up to {defaults.includedGuests} guests{defaults.extraGuest ? `; + ${euro(defaults.extraGuest)} per extra guest per night` : ""}.
            {n > 0 && extraGuests ? ` For ${guests} guests: ${euro(n + extraGuests * defaults.extraGuest)} a night.` : ""}
          </small>
        ) : null}
      </label>
      <label>
        <span>Minimum stay (optional)</span>
        <span className="price-input">
          <input value={minNights} onChange={(e) => setMinNights(e.target.value)} type="number" inputMode="numeric" min="1" max="60" step="1" placeholder={sameMin.size === 1 ? `now ${[...sameMin][0]}` : "standard"} />
          <i>nights</i>
        </span>
        <small className="price-field-note">For stays starting on these days. Empty: the standard minimum ({defaults.minNights || 1}).</small>
      </label>
      <label>
        <span>Name (optional)</span>
        <input className="price-text" value={label} onChange={(e) => setLabel(e.target.value)} type="text" maxLength={60} placeholder="e.g. Christmas & New Year" />
      </label>

      <div className="price-selected-actions">
        <button className="button primary" type="submit" disabled={Boolean(busy)}>
          {busy === "range" ? "Saving…" : `Save price for ${count === 1 ? "this night" : `${count} nights`}`}
        </button>
        {periods.length ? (
          <button
            className="host-link-btn"
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              void run("clear", { action: "clear-range", property: house.id, from, to }, `Use the standard price${defaults.nightly ? ` (${euro(defaults.nightly)})` : ""} for these ${count === 1 ? "night" : `${count} nights`} again?`)
            }
          >
            {busy === "clear" ? "Resetting…" : "Back to standard price"}
          </button>
        ) : null}
        <button className="host-link-btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
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
