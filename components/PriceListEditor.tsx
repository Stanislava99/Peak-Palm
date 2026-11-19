"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BlockedRange } from "@/lib/blocked-nights";
import { discountLabel, extraGuestsFor, guestNightPrice, minimumNights, nightDiscount, nightlyPrice, priceFromList, type PriceList } from "@/lib/price-math";

type House = "kaja" | "janis";
type HouseInfo = { id: House; name: string; maxGuests: number; defaultGuests: number };

// Building an Intl formatter is slow, and the price calendar formats hundreds of values per render: make each once.
const euroWhole = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euroCents = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const euro = (n: number) => (n % 1 ? euroCents : euroWhole).format(n);
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const day = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => {
  const key = JSON.stringify(opts);
  let format = dateFormats.get(key);
  if (!format) dateFormats.set(key, (format = new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" })));
  return format.format(new Date(`${iso}T12:00:00Z`));
};
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
  blocked = [],
  today,
}: {
  list: PriceList;
  houses: HouseInfo[];
  /** Nights already taken (Airbnb, Booking.com, direct, blocked here), per house. */
  taken: Record<House, string[]>;
  /** Nights the hosts blocked on this site (admin). */
  blocked?: BlockedRange[];
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
      <PriceCalendar list={list} houses={houses} taken={taken} blocked={blocked} today={today} busy={busy} note={note} run={run} />

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>Blocked nights</h2>
        </div>
        <p className="adm-sub">
          Nights you closed on your site (select them on the calendar and choose “Blocked”). Guests can’t book them here. They aren’t sent to Airbnb or
          Booking.com, so block them there too.
        </p>
        {blocked.length ? (
          <ul className="price-blocks">
            {blocked.map((b) => {
              const nights = Math.round((Date.parse(b.to) - Date.parse(b.from)) / 86_400_000) + 1;
              return (
                <li key={b.id}>
                  <span className={`price-dot is-${b.property}`} aria-hidden />
                  <div>
                    <b>{b.note || "Blocked"}</b>
                    <small>
                      {houses.find((h) => h.id === b.property)?.name} · {day(b.from)} – {day(b.to)} · {nights} night{nights === 1 ? "" : "s"}
                    </small>
                  </div>
                  <button
                    className="adm-btn"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => run(`unblock-${b.id}`, { action: "delete-block", id: b.id }, "Unblock these nights? Guests will be able to book them on your site again.")}
                  >
                    {busy === `unblock-${b.id}` ? "Unblocking…" : "Unblock"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="price-empty">Nothing blocked. All nights that are free on Airbnb and Booking.com can be booked on your site.</p>
        )}
      </section>

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
  const [discount, setDiscount] = useState(String(d.discount));

  const example = useMemo(() => {
    const n = Number(nightly);
    if (!(n > 0)) return null;
    const inc = Number(included) || null;
    const ex = Number(extra) || 0;
    const nights = Math.max(Number(minNights) || 1, 3);
    const guests = house.maxGuests;
    const extraGuests = inc && ex ? Math.max(0, guests - inc) : 0;
    const total = n * nights + extraGuests * ex * nights + (Number(cleaning) || 0);
    const pct = Math.min(Math.max(Number(discount) || 0, 0), 90);
    return { nights, guests, total, extraGuests, pct, direct: Math.round(total * (1 - pct / 100)) };
  }, [nightly, included, extra, cleaning, minNights, discount, house.maxGuests]);

  return (
    <form
      className="price-house"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ action: "defaults", property: house.id, nightly, includedGuests: included, extraGuest: extra, cleaning, minNights, discount });
      }}
    >
      <h3>
        Standard prices <small>{house.name} · sleeps {house.maxGuests}</small>
      </h3>
      <p className="price-panel-hint">Enter the same prices as on Airbnb. They apply to every night without a special price; to change some nights only, tap them on the calendar.</p>
      <div className="price-fields">
        <label>
          <span>Airbnb price per night</span>
          <span className="price-input">
            <i>€</i>
            <input value={nightly} onChange={(e) => setNightly(e.target.value)} type="number" inputMode="decimal" min="1" step="0.01" placeholder="e.g. 450" aria-label="Price per night" />
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
      <label className="price-discount">
        <span>Direct-booking discount</span>
        <span className="price-input">
          <input value={discount} onChange={(e) => setDiscount(e.target.value)} type="number" inputMode="decimal" min="0" max="90" step="0.5" required aria-label="Direct-booking discount" />
          <i>% off</i>
        </span>
        <small className="price-field-note">Guests booking on your site pay the Airbnb prices minus this, for every date (you can set a different discount for chosen nights on the calendar). 0 turns the discount off.</small>
      </label>
      <p className="price-example">
        {example ? (
          <>
            For example, {example.nights} nights for {example.guests} guests
            {example.extraGuests ? ` (${example.extraGuests} extra)` : ""}: {euro(example.total)} at Airbnb prices
            {example.pct > 0 ? (
              <>
                {" "}→ <b>{euro(example.direct)}</b> on your site (−{discountLabel(example.pct)})
              </>
            ) : null}
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
                {p.discount !== null ? ` · ${p.discount > 0 ? `${discountLabel(p.discount)} off on your site` : "no discount"}` : ""}
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
  blocked,
  today,
  busy,
  note,
  run,
}: {
  list: PriceList;
  houses: HouseInfo[];
  taken: Record<House, string[]>;
  blocked: BlockedRange[];
  today: string;
  busy: string | null;
  note: Note;
  run: Run;
}) {
  const [house, setHouse] = useState<House>(houses[0]?.id ?? "kaja");
  const [month, setMonth] = useState(today.slice(0, 7));
  const info = houses.find((h) => h.id === house)!;
  const defaults = list.defaults[house];
  const [guests, setGuests] = useState(info.defaultGuests);
  const takenSet = useMemo(() => new Set(taken[house] ?? []), [taken, house]);
  /** Blocked night → its block (for the note), for this house. */
  const blockedMap = useMemo(() => {
    const map = new Map<string, BlockedRange>();
    for (const b of blocked) if (b.property === house) for (let d = b.from; d <= b.to; d = addDays(d, 1)) map.set(d, b);
    return map;
  }, [blocked, house]);

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
  const [show, setShow] = useState<"airbnb" | "site">("airbnb");

  // Each night's price, label and note only change with the month, house, guests or prices, not while
  // you hover or select, so they're worked out once here instead of on every mouse move.
  const cells = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, "0")}`;
        const { price: base, period } = nightlyPrice(list, house, date);
        const pct = nightDiscount(list, house, date);
        const price = base === null ? null : show === "site" ? guestNightPrice(list, house, date, guests) : base + extra;
        const min = minimumNights(list, house, date);
        const block = blockedMap.get(date);
        const isTaken = !block && takenSet.has(date);
        const label = `${day(date, { weekday: "long", day: "numeric", month: "long" })}: ${price === null ? "no price" : euro(price)}${show === "site" && pct ? ` after ${discountLabel(pct)} off` : ""}${period ? `, ${period.label || "special price"}` : ""}${isTaken ? ", taken" : ""}${block ? `, blocked${block.note ? ` (${block.note})` : ""}` : ""}`;
        const note = block ? "blocked" : isTaken ? "taken" : period?.label ? period.label : pct !== defaults.discount ? `${pct > 0 ? `−${discountLabel(pct)}` : "no discount"}` : min > 1 ? `min ${min}` : " ";
        return { date, n: i + 1, period, price, label, note, isTaken, block, past: date < today };
      }),
    [daysInMonth, month, list, house, show, guests, extra, blockedMap, takenSet, defaults.discount, today],
  );

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
                  setGuests(h.defaultGuests);
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
          <div className="adm-seg" role="tablist" aria-label="Which prices">
            {(
              [
                ["airbnb", "Airbnb prices"],
                ["site", "Your site"],
              ] as const
            ).map(([key, text]) => (
              <a
                key={key}
                href="#price-calendar"
                role="tab"
                aria-current={show === key ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setShow(key);
                }}
              >
                {text}
              </a>
            ))}
          </div>
        </div>
      </div>
      <p className="adm-sub" id="price-calendar">
        Tap the first and the last <b>night</b> to change their price or discount (the day guests leave isn’t a night). Showing{" "}
        {show === "airbnb" ? "the Airbnb price" : "what guests pay on your site, after the discount"} per night for {guests} guest
        {guests === 1 ? "" : "s"}, without the cleaning fee.
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
            {cells.map(({ date, n, period, price, label, note, isTaken, block, past }) => {
              const selected = inRange(date);
              const cls = [
                "price-cal-day",
                period ? "is-special" : "",
                isTaken ? "is-taken" : "",
                block ? "is-blocked" : "",
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
                  aria-label={label}
                  onClick={() => pick(date)}
                  onMouseEnter={() => setHover(date)}
                >
                  <span className="price-cal-num">{n}</span>
                  <strong>{price === null ? "—" : euro(Math.round(price))}</strong>
                  <small>{note}</small>
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
            <span>
              <i className="is-blocked" /> Blocked by you
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
              blockedMap={blockedMap}
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
  blockedMap,
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
  blockedMap: Map<string, BlockedRange>;
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
  const blockedCount = nights.filter((n) => blockedMap.has(n)).length;
  const takenCount = nights.filter((n) => takenSet.has(n) && !blockedMap.has(n)).length;
  const blockNotes = [...new Set(nights.map((n) => blockedMap.get(n)?.note).filter(Boolean))];
  const [blockNote, setBlockNote] = useState(blockNotes.length === 1 ? blockNotes[0]! : "");
  const sameMin = new Set(nights.map((n) => minimumNights(list, house.id, n)));

  const [nightly, setNightly] = useState(low !== null && low === high && known.length === nights.length ? String(low) : "");
  // Pre-fill name and minimum only when every chosen night belongs to the same special price.
  const whole = periods.length === 1 && prices.every((p) => p.period?.id === periods[0].id) ? periods[0] : null;
  const [minNights, setMinNights] = useState(whole?.minNights ? String(whole.minNights) : "");
  const [label, setLabel] = useState(whole?.label ?? "");
  const [discount, setDiscount] = useState(whole?.discount != null ? String(whole.discount) : "");

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
        void run("range", { action: "set-range", property: house.id, from, to, nightly, minNights, label, discount });
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

      <div className="price-avail">
        <div className="price-avail-head">
          <b>Can guests book {count === 1 ? "this night" : "these nights"} on your site?</b>
          <span className="price-avail-toggle" role="group" aria-label="Availability">
            <button
              type="button"
              aria-pressed={blockedCount === 0}
              disabled={Boolean(busy) || blockedCount === 0}
              onClick={() => void run("unblock", { action: "unblock-range", property: house.id, from, to })}
            >
              {busy === "unblock" ? "Opening…" : "Bookable"}
            </button>
            <button
              type="button"
              className="is-block"
              aria-pressed={blockedCount === count}
              disabled={Boolean(busy) || blockedCount === count}
              onClick={() => void run("block", { action: "block-range", property: house.id, from, to, note: blockNote })}
            >
              {busy === "block" ? "Blocking…" : "Blocked"}
            </button>
          </span>
        </div>
        {blockedCount > 0 && blockedCount < count ? (
          <p className="price-panel-hint">
            {blockedCount} of these {count} nights {blockedCount === 1 ? "is" : "are"} blocked. Choose “Blocked” to block them all, or “Bookable” to open them all.
          </p>
        ) : null}
        <label>
          <span>Note (optional, only you see it)</span>
          <input
            className="price-text"
            value={blockNote}
            onChange={(e) => setBlockNote(e.target.value)}
            type="text"
            maxLength={80}
            placeholder="e.g. Family stay, repairs, booked by phone"
            aria-label="Block note"
          />
        </label>
        <small className="price-field-note">
          {blockedCount === count
            ? "Blocked on your site. Choose “Bookable” to open again (nights taken on Airbnb or Booking.com stay closed)."
            : "Blocking closes these nights on your site only. Block them on Airbnb and Booking.com too."}
        </small>
      </div>

      <label>
        <span>Airbnb price per night</span>
        <span className="price-input">
          <i>€</i>
          <input aria-label="Price per night" value={nightly} onChange={(e) => setNightly(e.target.value)} type="number" inputMode="decimal" min="1" step="0.01" required placeholder="e.g. 650" autoFocus={chosenBoth} />
        </span>
        {defaults.includedGuests ? (
          <small className="price-field-note">
            For up to {defaults.includedGuests} guests{defaults.extraGuest ? `; + ${euro(defaults.extraGuest)} per extra guest per night` : ""}.
            {n > 0 && extraGuests ? ` For ${guests} guests: ${euro(n + extraGuests * defaults.extraGuest)} a night.` : ""}
          </small>
        ) : null}
      </label>
      <label>
        <span>Discount on your site (optional)</span>
        <span className="price-input">
          <input aria-label="Discount for these nights" value={discount} onChange={(e) => setDiscount(e.target.value)} type="number" inputMode="decimal" min="0" max="90" step="0.5" placeholder={`standard (${discountLabel(defaults.discount)})`} />
          <i>% off</i>
        </span>
        <small className="price-field-note">
          {n > 0
            ? `Guests on your site pay ${euro(Math.round((n + extraGuests * defaults.extraGuest) * (1 - (discount === "" ? defaults.discount : Math.min(Math.max(Number(discount) || 0, 0), 90)) / 100)))} a night for ${guests} guest${guests === 1 ? "" : "s"}.`
            : `Empty: the standard ${discountLabel(defaults.discount)}.`}
          {discount !== "" && Number(discount) < defaults.discount ? " The site advertises the standard discount, so these dates save less than advertised." : ""}
        </small>
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
  const [guests, setGuests] = useState(info.defaultGuests);
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
              setGuests(houses.find((h) => h.id === next)!.defaultGuests);
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
            {priced.discountAmount > 0 ? (
              <>
                <div className="is-sub">
                  <dt>At Airbnb prices</dt>
                  <dd>{euro(priced.listTotal)}</dd>
                </div>
                <div className="is-discount">
                  <dt>Direct-booking discount ({discountLabel(priced.discountPct)})</dt>
                  <dd>−{euro(priced.discountAmount)}</dd>
                </div>
              </>
            ) : null}
            <div className="is-total">
              <dt>Guest pays on your site</dt>
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
