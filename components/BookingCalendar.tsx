import type { Booking } from "@/lib/bookings";
import type { PropertyId } from "@/lib/properties";
import { HOUSES, isLive, nightRanges, occupancy } from "@/lib/admin-data";
import { CalendarScroll } from "./CalendarScroll";

export type CalendarMonth = { year: number; month: number }; // month 1–12

export function parseMonth(value: string | undefined, today = new Date()): CalendarMonth {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { year: Number(m[1]), month: Number(m[2]) };
  return { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 };
}

export function parseSpan(value: string | undefined) {
  const n = Number(value);
  return n === 2 || n === 3 ? n : 1;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const monthKey = ({ year, month }: CalendarMonth) => `${year}-${pad(month)}`;
export function shiftMonth({ year, month }: CalendarMonth, by: number): CalendarMonth {
  const d = new Date(Date.UTC(year, month - 1 + by, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
export function monthRange(m: CalendarMonth, span = 1) {
  const next = shiftMonth(m, span);
  return { from: `${monthKey(m)}-01`, to: `${monthKey(next)}-01` };
}

function daysOf(from: string, to: string) {
  const out: Array<{ date: string; day: number; weekday: number; weekend: boolean; first: boolean }> = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  while (cursor.toISOString().slice(0, 10) < to) {
    const date = cursor.toISOString().slice(0, 10);
    const weekday = cursor.getUTCDay();
    out.push({ date, day: cursor.getUTCDate(), weekday, weekend: weekday === 0 || weekday === 6, first: cursor.getUTCDate() === 1 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export type OtherChannels = Record<PropertyId, { airbnb: Set<string>; booking: Set<string> }>;

type Item =
  | { type: "direct"; key: string; start: string; end: string; booking: Booking }
  | { type: "other"; key: string; start: string; end: string; channel: "airbnb" | "booking" };

/** Puts overlapping items on separate lines (only happens on the test site, where dates never block). */
function lanes(items: Item[]) {
  const ends: string[] = [];
  return items
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((item) => {
      let lane = ends.findIndex((end) => end <= item.start);
      if (lane === -1) lane = ends.push(item.end) - 1;
      else ends[lane] = item.end;
      return { item, lane };
    });
}

function kindOf(b: Booking) {
  if (b.rawStatus === "awaiting_payment") return "hold";
  return b.status === "confirmed" ? "confirmed" : "pending";
}

const LABEL = { confirmed: "Confirmed", pending: "Deposit paid · waiting for you", hold: "Paying now (not paid yet)" } as const;
const MARK = { confirmed: "✓", pending: "!", hold: "…" } as const;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Timeline of both houses (rows) across one to three months (columns, two per day so a stay runs
 * from the check-in afternoon to the check-out morning). Direct stays are coloured bars that open
 * the booking side panel; Airbnb and Booking.com nights are labelled grey blocks.
 */
export function BookingCalendar({
  month,
  span,
  today,
  bookings,
  other,
  link,
}: {
  month: CalendarMonth;
  span: number;
  today: string;
  bookings: Booking[];
  other: OtherChannels;
  /** Builds the admin URL with changed query values (keeps the current view). */
  link: (changes: Record<string, string | null>) => string;
}) {
  const { from, to } = monthRange(month, span);
  const days = daysOf(from, to);
  const fmt = (iso: string, withYear: boolean) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
  const lastMonth = monthRange(shiftMonth(month, span - 1)).from;
  const title = span === 1 ? fmt(from, true) : `${fmt(from, month.year !== shiftMonth(month, span - 1).year)} – ${fmt(lastMonth, true)}`;
  const index = new Map(days.map((d, i) => [d.date, i]));
  const am = (date: string) => (index.get(date) ?? 0) * 2 + 2; // column 1 is the house name
  const last = days.length * 2 + 2;
  const cols = { gridTemplateColumns: `var(--cal-name, 8.5rem) repeat(${days.length * 2}, minmax(${span === 1 ? "0.8rem" : "0.62rem"}, 1fr))` };
  const m = monthKey(month);

  return (
    <section className="adm-card adm-calendar" id="calendar" aria-label="Bookings calendar">
      <div className="cal-head">
        <div>
          <h2>{title}</h2>
          <p className="adm-sub">Both houses · direct bookings, Airbnb and Booking.com</p>
        </div>
        <div className="cal-tools">
          <nav className="adm-seg" aria-label="How many months">
            {[1, 2, 3].map((n) => (
              <a key={n} href={link({ span: n === 1 ? null : String(n), b: null })} aria-current={n === span ? "true" : undefined}>
                {n}M
              </a>
            ))}
          </nav>
          <nav className="adm-seg" aria-label="Month">
            <a href={link({ m: monthKey(shiftMonth(month, -1)), b: null })} aria-label="Previous month">
              ‹
            </a>
            <a href={link({ m: null, b: null })} aria-current={m === today.slice(0, 7) ? "true" : undefined}>
              Today
            </a>
            <a href={link({ m: monthKey(shiftMonth(month, 1)), b: null })} aria-label="Next month">
              ›
            </a>
          </nav>
        </div>
      </div>

      <div className="cal-stats">
        {HOUSES.map((house) => {
          const o = other[house.id] ?? { airbnb: new Set<string>(), booking: new Set<string>() };
          const occ = occupancy(bookings, new Set([...o.airbnb, ...o.booking]), house.id, from, to);
          const arrivals = bookings.filter((b) => b.property === house.id && isLive(b) && b.checkIn >= from && b.checkIn < to).length;
          return (
            <div className="cal-stat" key={house.id}>
              <div className="cal-stat-top">
                <b>{house.name}</b>
                <span>{pct(occ.rate)} booked</span>
              </div>
              <div className="cal-meter" role="img" aria-label={`${occ.direct} direct nights and ${occ.other} on other channels out of ${occ.total}`}>
                <i className="is-direct" style={{ width: pct(occ.direct / occ.total) }} />
                <i className="is-other" style={{ width: pct(occ.other / occ.total) }} />
              </div>
              <small>
                {occ.direct} direct night{occ.direct === 1 ? "" : "s"} · {occ.other} Airbnb/Booking.com · {occ.total - occ.direct - occ.other} free · {arrivals} direct
                arrival{arrivals === 1 ? "" : "s"}
              </small>
            </div>
          );
        })}
      </div>

      <CalendarScroll>
        {HOUSES.map((house) => {
          const mine = bookings.filter((b) => b.property === house.id && b.checkOut > from && b.checkIn < to);
          const directNights = new Set<string>();
          for (const b of mine.filter(isLive)) {
            for (let d = b.checkIn; d < b.checkOut; d = new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) directNights.add(d);
          }
          const o = other[house.id] ?? { airbnb: new Set<string>(), booking: new Set<string>() };
          // Booking.com nights usually also show as blocked on Airbnb: label them Booking.com.
          // Direct stays you've blocked on Airbnb are already drawn as direct bars.
          const bookingNights = [...o.booking].filter((n) => n >= from && n < to && !directNights.has(n));
          const airbnbNights = [...o.airbnb].filter((n) => n >= from && n < to && !directNights.has(n) && !o.booking.has(n));
          const items: Item[] = [
            ...mine.map((b) => ({ type: "direct" as const, key: b.ref, start: b.checkIn, end: b.checkOut, booking: b })),
            ...nightRanges(bookingNights).map((r) => ({ type: "other" as const, key: `bk-${r.start}`, ...r, channel: "booking" as const })),
            ...nightRanges(airbnbNights).map((r) => ({ type: "other" as const, key: `ab-${r.start}`, ...r, channel: "airbnb" as const })),
          ];
          const placed = lanes(items);
          const laneCount = Math.max(1, ...placed.map((p) => p.lane + 1));
          return (
            <div className="cal-house" key={house.id} style={cols} role="group" aria-label={house.name}>
              <div className="cal-name" style={{ gridRow: `1 / span ${laneCount + 1}` }}>
                {house.name}
              </div>
              {days.map((d) => (
                <div
                  key={d.date}
                  className={`cal-day${d.weekend ? " is-weekend" : ""}${d.date === today ? " is-today" : ""}${d.date < today ? " is-past" : ""}${d.first ? " is-first" : ""}`}
                  style={{ gridColumn: `${am(d.date)} / span 2`, gridRow: 1 }}
                >
                  <small>{d.first && span > 1 ? new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) : "SMTWTFS"[d.weekday]}</small>
                  {d.day}
                </div>
              ))}
              {days.map((d) => (
                <div
                  key={`bg-${d.date}`}
                  className={`cal-cell${d.weekend ? " is-weekend" : ""}${d.date === today ? " is-today" : ""}${d.date < today ? " is-past" : ""}${d.first ? " is-first" : ""}`}
                  style={{ gridColumn: `${am(d.date)} / span 2`, gridRow: `2 / span ${laneCount}` }}
                />
              ))}
              {placed.map(({ item, lane }) => {
                const start = item.start < from ? 2 : am(item.start) + 1;
                const end = item.end >= to ? last : am(item.end) + 1;
                const cut = `${item.start < from ? " cut-start" : ""}${item.end > to ? " cut-end" : ""}`;
                const style = { gridColumn: `${start} / ${Math.max(end, start + 1)}`, gridRow: lane + 2 };
                if (item.type === "other") {
                  const name = item.channel === "booking" ? "Booking.com" : "Airbnb";
                  return (
                    <span
                      key={item.key}
                      className={`cal-bar is-other is-${item.channel}${cut}`}
                      style={style}
                      title={`${item.start} → ${item.end}: ${item.channel === "booking" ? "Booking.com" : "taken on Airbnb, or blocked by you"}`}
                    >
                      <b className="cal-chan">{item.channel === "booking" ? "B" : "A"}</b>
                      {name}
                    </span>
                  );
                }
                const b = item.booking;
                const kind = kindOf(b);
                const first = b.name.trim().split(/\s+/)[0] || "Guest";
                const label = `${b.name}, ${b.checkIn} to ${b.checkOut}, ${b.guests} guests, ${LABEL[kind]}`;
                return kind === "hold" ? (
                  <span key={item.key} className={`cal-bar is-hold${cut}`} style={style} title={label}>
                    <b className="cal-chan">{MARK[kind]}</b>
                    {first}
                  </span>
                ) : (
                  <a key={item.key} href={link({ b: b.ref })} className={`cal-bar is-${kind}${cut}`} style={style} title={label} aria-label={label}>
                    <b className="cal-chan" aria-hidden="true">
                      {MARK[kind]}
                    </b>
                    {first} · {b.guests}
                  </a>
                );
              })}
            </div>
          );
        })}
      </CalendarScroll>
      <p className="cal-legend">
        <span>
          <i className="cal-key is-confirmed" /> ✓ Confirmed
        </span>
        <span>
          <i className="cal-key is-pending" /> ! Waiting for you
        </span>
        <span>
          <i className="cal-key is-hold" /> … Paying right now
        </span>
        <span>
          <i className="cal-key is-airbnb" /> Airbnb or blocked
        </span>
        <span>
          <i className="cal-key is-booking" /> Booking.com
        </span>
        <span className="cal-hint">Bars run from the check-in afternoon to the check-out morning. Tap a direct stay to open it.</span>
      </p>
    </section>
  );
}
