import type { Booking } from "./bookings";
import type { PropertyId } from "./properties";
import { eachNight, nightsBetween } from "./stay";

/**
 * Pure helpers behind /admin: today's movements, the guest list and the revenue figures.
 * Everything here is computed from direct-site bookings only (Airbnb / Booking.com money never
 * reaches this site), so the revenue view is "revenue from the site".
 */

export const HOUSES: Array<{ id: PropertyId; name: string; short: string }> = [
  { id: "kaja", name: "Villa Kaja", short: "Kaja" },
  { id: "janis", name: "Jani’s Beach House", short: "Jani’s" },
];
export const HOUSE_NAME: Record<PropertyId, string> = { kaja: "Villa Kaja", janis: "Jani’s Beach House" };

/** A booking that has money attached: deposit paid, waiting or confirmed. */
export const isLive = (b: Booking) => b.status === "pending" || b.status === "confirmed";

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return nightsBetween(from, to);
}

/* ── Today ─────────────────────────────────────────────── */

export type Movements = {
  arrivalsToday: Booking[];
  departuresToday: Booking[];
  inHouse: Booking[];
  nextArrivals: Booking[];
  nextDepartures: Booking[];
};

/** Who arrives, leaves and is staying. Pending stays count too: the guest has paid and is coming unless you decline. */
export function movements(bookings: Booking[], today: string, horizon = 14): Movements {
  const live = bookings.filter(isLive);
  const until = addDays(today, horizon);
  const byIn = (a: Booking, b: Booking) => a.checkIn.localeCompare(b.checkIn);
  const byOut = (a: Booking, b: Booking) => a.checkOut.localeCompare(b.checkOut);
  return {
    arrivalsToday: live.filter((b) => b.checkIn === today),
    departuresToday: live.filter((b) => b.checkOut === today),
    inHouse: live.filter((b) => b.checkIn <= today && b.checkOut > today).sort(byOut),
    nextArrivals: live.filter((b) => b.checkIn > today && b.checkIn <= until).sort(byIn),
    nextDepartures: live.filter((b) => b.checkOut > today && b.checkOut <= until).sort(byOut),
  };
}

/* ── Guests ────────────────────────────────────────────── */

export type Guest = {
  key: string;
  name: string;
  email: string;
  phone: string;
  stays: number;
  nights: number;
  spent: number;
  houses: PropertyId[];
  firstStay: string;
  lastStay: string | null;
  nextStay: string | null;
  refs: string[];
  /** Latest booking ref, for opening the side panel. */
  latestRef: string;
  repeat: boolean;
  /** Agreed to offers by email at checkout (latest time), and hasn't unsubscribed since. */
  offersOk: boolean;
  offersSince: string | null;
  /** When they unsubscribed (or a host removed them), if they did. */
  optedOutAt: string | null;
};

/**
 * One row per guest, matched by email (case-insensitive). Only paid stays count
 * (waiting or confirmed); declined and abandoned checkouts are left out.
 */
export function guestList(bookings: Booking[], today: string, optOuts: Map<string, string> = new Map()): Guest[] {
  const map = new Map<string, Guest>();
  const sorted = bookings.filter(isLive).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  for (const b of sorted) {
    const key = (b.email || b.name).trim().toLowerCase();
    if (!key) continue;
    const nights = nightsBetween(b.checkIn, b.checkOut);
    const g =
      map.get(key) ??
      ({
        key,
        name: b.name,
        email: b.email,
        phone: b.phone,
        stays: 0,
        nights: 0,
        spent: 0,
        houses: [],
        firstStay: b.checkIn,
        lastStay: null,
        nextStay: null,
        refs: [],
        latestRef: b.ref,
        repeat: false,
        offersOk: false,
        offersSince: null,
        optedOutAt: null,
      } satisfies Guest);
    g.stays += 1;
    g.nights += nights;
    g.spent += b.directTotal;
    if (!g.houses.includes(b.property)) g.houses.push(b.property);
    g.refs.push(b.ref);
    g.latestRef = b.ref;
    g.name = b.name || g.name;
    g.phone = b.phone || g.phone;
    if (b.checkIn < today) g.lastStay = b.checkIn;
    else if (!g.nextStay) g.nextStay = b.checkIn;
    g.repeat = g.stays > 1;
    if (b.marketingOptInAt && (!g.offersSince || b.marketingOptInAt > g.offersSince)) g.offersSince = b.marketingOptInAt;
    map.set(key, g);
  }
  for (const g of map.values()) {
    g.optedOutAt = optOuts.get(g.email.trim().toLowerCase()) ?? null;
    g.offersOk = Boolean(g.offersSince && (!g.optedOutAt || g.offersSince > g.optedOutAt));
  }
  return [...map.values()].sort((a, b) => (b.nextStay ?? b.lastStay ?? "").localeCompare(a.nextStay ?? a.lastStay ?? ""));
}

/* ── Revenue ───────────────────────────────────────────── */

export type Money = {
  /** Value of paid stays (waiting + confirmed) by check-in date. */
  booked: number;
  /** Deposits received for live stays plus cash balances marked received. */
  collected: number;
  /** Cash balances still to be paid at check-in (confirmed or waiting). */
  cashDue: number;
  /** Deposits refunded on declined bookings. */
  refunded: number;
  /** What guests saved against the Airbnb price for the same stays. */
  guestSavings: number;
  stays: number;
  nights: number;
  guests: number;
  /** Booked ÷ nights. */
  adr: number;
  avgStay: number;
  /** Days between booking and check-in, on average. */
  leadTime: number;
  /** Estimated Stripe fees on the deposits (EEA card rate; not returned on refunds). */
  stripeFees: number;
  /** Estimated extra the host keeps against the same stays booked on Airbnb (see AIRBNB_HOST_FEE). */
  keptVsAirbnb: number;
  /** Declined ÷ all paid bookings. */
  declineRate: number;
};

/**
 * Estimates for the "direct vs Airbnb" figure. Airbnb's host-only fee (about 15.5%) applies to
 * EEA bookings from mid-October 2026; Stripe's standard EEA card price is 1.5% + €0.25
 * (non-EEA cards cost more). Edit these if your rates differ.
 */
export const AIRBNB_HOST_FEE = 0.155;
export const STRIPE_PERCENT = 0.015;
export const STRIPE_FIXED = 0.25;
export const stripeFee = (amount: number) => (amount > 0 ? amount * STRIPE_PERCENT + STRIPE_FIXED : 0);

const empty = (): Money => ({
  booked: 0, collected: 0, cashDue: 0, refunded: 0, guestSavings: 0, stays: 0, nights: 0, guests: 0, adr: 0, avgStay: 0, leadTime: 0,
  stripeFees: 0, keptVsAirbnb: 0, declineRate: 0,
});

export function money(bookings: Booking[]): Money {
  const m = empty();
  let lead = 0;
  let declined = 0;
  for (const b of bookings) {
    if (b.status === "declined") {
      m.refunded += b.deposit;
      m.stripeFees += stripeFee(b.deposit);
      declined += 1;
      continue;
    }
    if (!isLive(b)) continue;
    const nights = nightsBetween(b.checkIn, b.checkOut);
    m.booked += b.directTotal;
    m.collected += b.deposit + (b.balancePaid ? b.balance : 0);
    if (!b.balancePaid) m.cashDue += b.balance;
    m.stripeFees += stripeFee(b.deposit);
    if (b.airbnbTotal && b.airbnbTotal > b.directTotal) {
      m.guestSavings += b.airbnbTotal - b.directTotal;
      m.keptVsAirbnb += b.directTotal - stripeFee(b.deposit) - b.airbnbTotal * (1 - AIRBNB_HOST_FEE);
    }
    m.stays += 1;
    m.nights += nights;
    m.guests += b.guests;
    lead += Math.max(0, nightsBetween(b.createdAt.slice(0, 10), b.checkIn));
  }
  m.adr = m.nights ? m.booked / m.nights : 0;
  m.avgStay = m.stays ? m.nights / m.stays : 0;
  m.leadTime = m.stays ? lead / m.stays : 0;
  m.declineRate = m.stays + declined ? declined / (m.stays + declined) : 0;
  return m;
}

export type MonthBar = { month: number; label: string; kaja: number; janis: number; nights: Record<PropertyId, number> };

/** Booked value per check-in month of a year, split by house (for the bar chart). */
export function monthlyRevenue(bookings: Booking[], year: number): MonthBar[] {
  const bars: MonthBar[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: new Date(Date.UTC(year, i, 1)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
    kaja: 0,
    janis: 0,
    nights: { kaja: 0, janis: 0 },
  }));
  for (const b of bookings) {
    if (!isLive(b) || !b.checkIn.startsWith(String(year))) continue;
    const bar = bars[Number(b.checkIn.slice(5, 7)) - 1];
    bar[b.property] += b.directTotal;
    bar.nights[b.property] += nightsBetween(b.checkIn, b.checkOut);
  }
  return bars;
}

export function stayYear(b: Booking) {
  return Number(b.checkIn.slice(0, 4));
}

/** Years that have any stays, newest first, always including the current year. */
export function revenueYears(bookings: Booking[], current: number) {
  const years = new Set<number>([current]);
  for (const b of bookings) if (isLive(b) && b.checkIn) years.add(stayYear(b));
  return [...years].sort((a, b) => b - a);
}

/* ── Occupancy (calendar) ──────────────────────────────── */

/**
 * Share of nights in [from, to) that are taken, per source. Direct = paid direct stays;
 * other = Airbnb / Booking.com / blocked (minus nights already counted as direct).
 */
export function occupancy(bookings: Booking[], other: Set<string>, property: PropertyId, from: string, to: string) {
  const total = Math.max(1, nightsBetween(from, to));
  const direct = new Set<string>();
  for (const b of bookings) {
    if (b.property !== property || !isLive(b)) continue;
    for (const n of eachNight(b.checkIn, b.checkOut)) if (n >= from && n < to) direct.add(n);
  }
  let elsewhere = 0;
  for (const n of other) if (n >= from && n < to && !direct.has(n)) elsewhere += 1;
  return { total, direct: direct.size, other: elsewhere, rate: (direct.size + elsewhere) / total };
}

/** Consecutive nights merged into ranges [start, endExclusive). */
export function nightRanges(nights: Iterable<string>) {
  const sorted = [...new Set(nights)].sort();
  const ranges: Array<{ start: string; end: string }> = [];
  for (const n of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && last.end === n) last.end = addDays(n, 1);
    else ranges.push({ start: n, end: addDays(n, 1) });
  }
  return ranges;
}

/* ── CSV ───────────────────────────────────────────────── */

export function csv(rows: Array<Array<string | number | null | undefined>>) {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Stop spreadsheet apps from running a cell as a formula.
    // (A phone number like "+359 88…" is left alone.)
    if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s().-]*$/.test(s))) s = `'${s}`;
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
}
