import type { PropertyId } from "./properties";
import { eachNight } from "./stay";

/**
 * The hosts' price list and how a stay is priced from it. Pure (no database), so the server,
 * the admin price calendar and the admin "try a stay" calculator all give the same answer.
 */
export type PriceDefaults = {
  property: PropertyId;
  /** Price per night for up to `includedGuests` guests. Null: no default price. */
  nightly: number | null;
  cleaning: number;
  minNights: number;
  /** How many guests the nightly price covers. Null: the price is the same for any group size. */
  includedGuests: number | null;
  /** Added per extra guest, per night, above `includedGuests`. */
  extraGuest: number;
  /** Direct-booking discount in % (0–90): guests on this site pay the prices above minus this. */
  discount: number;
};

export type PricePeriod = {
  id: number;
  property: PropertyId;
  /** First night the price applies to. */
  from: string;
  /** Last night the price applies to (inclusive). */
  to: string;
  /** Price per night for up to the house's included guests. */
  nightly: number;
  label: string;
  /** Minimum nights for stays starting in this period (null: the house default). */
  minNights: number | null;
  /** Direct-booking discount in % for these nights (null: the house's standard discount). */
  discount: number | null;
};

export type PriceList = { defaults: Record<PropertyId, PriceDefaults>; periods: PricePeriod[] };

export type PricedStay = {
  /** What the guest pays on this site (after the direct-booking discount). */
  total: number;
  /** The same stay at the entered (Airbnb) prices, before the discount. */
  listTotal: number;
  /** listTotal − total */
  discountAmount: number;
  /** The discount as a % of listTotal (one decimal); the same as the house discount unless some nights differ. */
  discountPct: number;
  nights: number;
  /** Nights at the base price (for up to the included guests). */
  nightsTotal: number;
  extraGuests: number;
  extraGuestRate: number;
  /** extraGuests × extraGuestRate × nights */
  extraTotal: number;
  cleaning: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Discount used when a house has no saved setting yet. */
export const DEFAULT_DISCOUNT = 10;

/** "10%" (or "12.5%"). */
export function discountLabel(pct: number) {
  return `${Math.round(pct * 10) / 10}%`;
}

/** The base nightly price for one night (for up to the included guests), or null if none is set. */
export function nightlyPrice(list: PriceList, property: PropertyId, night: string): { price: number | null; period: PricePeriod | null } {
  const period = list.periods.filter((p) => p.property === property && p.from <= night && night <= p.to).sort((a, b) => b.id - a.id)[0] ?? null;
  const price = period ? period.nightly : (list.defaults[property]?.nightly ?? null);
  return { price: price !== null && price > 0 ? price : null, period };
}

/** Minimum nights for a check-in date: the newest period covering it, else the house default, else 1. */
export function minimumNights(list: PriceList, property: PropertyId, date: string) {
  const period = list.periods.filter((p) => p.property === property && p.minNights && p.from <= date && date <= p.to).sort((a, b) => b.id - a.id)[0];
  return period?.minNights ?? list.defaults[property]?.minNights ?? 1;
}

/** The direct-booking discount (%) for one night: the newest special price with its own discount, else the house's. */
export function nightDiscount(list: PriceList, property: PropertyId, night: string) {
  const { period } = nightlyPrice(list, property, night);
  return period?.discount ?? list.defaults[property]?.discount ?? DEFAULT_DISCOUNT;
}

/** The average discount (%) over the nights of a stay (used on the live Airbnb price, when there is one). */
export function stayDiscount(list: PriceList, property: PropertyId, checkIn: string, checkOut: string) {
  const nights = eachNight(checkIn, checkOut);
  if (!nights.length) return list.defaults[property]?.discount ?? DEFAULT_DISCOUNT;
  return nights.reduce((sum, night) => sum + nightDiscount(list, property, night), 0) / nights.length;
}

/** What a guest pays on this site for one night for `guests` guests (null: no price). */
export function guestNightPrice(list: PriceList, property: PropertyId, night: string, guests: number) {
  const { price } = nightlyPrice(list, property, night);
  if (price === null) return null;
  const defaults = list.defaults[property];
  const extra = extraGuestsFor(defaults, guests) * (defaults?.extraGuest ?? 0);
  return round2((price + extra) * (1 - nightDiscount(list, property, night) / 100));
}

/** Extra guests above what the nightly price covers. */
export function extraGuestsFor(defaults: PriceDefaults | undefined, guests: number) {
  if (!defaults?.includedGuests || !(defaults.extraGuest > 0)) return 0;
  return Math.max(0, guests - defaults.includedGuests);
}

/**
 * Direct price for a stay from the price list: each night's entered (Airbnb) price plus the extra-guest
 * charge, less that night's direct-booking discount; plus the cleaning fee less the house's discount.
 * Null if a night has no price.
 */
export function priceFromList(list: PriceList, property: PropertyId, checkIn: string, checkOut: string, guests = 1): PricedStay | null {
  const nights = eachNight(checkIn, checkOut);
  if (!nights.length) return null;
  const defaults = list.defaults[property];
  const extraGuests = extraGuestsFor(defaults, guests);
  const extraGuestRate = extraGuests ? defaults!.extraGuest : 0;
  let nightsTotal = 0;
  let paid = 0;
  for (const night of nights) {
    const { price } = nightlyPrice(list, property, night);
    if (price === null) return null;
    nightsTotal += price;
    paid += (price + extraGuests * extraGuestRate) * (1 - nightDiscount(list, property, night) / 100);
  }
  const extraTotal = round2(extraGuests * extraGuestRate * nights.length);
  const cleaning = defaults?.cleaning ?? 0;
  paid += cleaning * (1 - (defaults?.discount ?? DEFAULT_DISCOUNT) / 100);
  const listTotal = round2(nightsTotal + extraTotal + cleaning);
  const total = Math.round(paid);
  const discountAmount = round2(Math.max(0, listTotal - total));
  return {
    total,
    listTotal,
    discountAmount,
    // From the unrounded price, so a 12% discount reads 12%, not 12.1% after rounding to whole euros.
    discountPct: listTotal > 0 ? Math.round(((listTotal - paid) / listTotal) * 1000) / 10 : 0,
    nights: nights.length,
    nightsTotal: round2(nightsTotal),
    extraGuests,
    extraGuestRate,
    extraTotal,
    cleaning,
  };
}
