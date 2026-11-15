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
};

export type PriceList = { defaults: Record<PropertyId, PriceDefaults>; periods: PricePeriod[] };

export type PricedStay = {
  total: number;
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

/** Extra guests above what the nightly price covers. */
export function extraGuestsFor(defaults: PriceDefaults | undefined, guests: number) {
  if (!defaults?.includedGuests || !(defaults.extraGuest > 0)) return 0;
  return Math.max(0, guests - defaults.includedGuests);
}

/**
 * Direct price for a stay from the price list: each night's base price (period or default),
 * plus the extra-guest charge per night, plus the cleaning fee. Null if a night has no price.
 */
export function priceFromList(list: PriceList, property: PropertyId, checkIn: string, checkOut: string, guests = 1): PricedStay | null {
  const nights = eachNight(checkIn, checkOut);
  if (!nights.length) return null;
  let nightsTotal = 0;
  for (const night of nights) {
    const { price } = nightlyPrice(list, property, night);
    if (price === null) return null;
    nightsTotal += price;
  }
  const defaults = list.defaults[property];
  const extraGuests = extraGuestsFor(defaults, guests);
  const extraGuestRate = extraGuests ? defaults!.extraGuest : 0;
  const extraTotal = round2(extraGuests * extraGuestRate * nights.length);
  const cleaning = defaults?.cleaning ?? 0;
  return {
    total: round2(nightsTotal + extraTotal + cleaning),
    nights: nights.length,
    nightsTotal: round2(nightsTotal),
    extraGuests,
    extraGuestRate,
    extraTotal,
    cleaning,
  };
}
