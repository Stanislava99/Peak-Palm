import type { PoolClient } from "pg";
import { dbConfigured, q, tx } from "./db";
import type { PropertyId } from "./properties";

import { DEFAULT_DISCOUNT, type PriceDefaults, type PriceList, type PricePeriod } from "./price-math";

/**
 * The hosts' own price list (admin → Prices), stored in the database: the same prices as on Airbnb,
 * plus a direct-booking discount (per house, optionally per dates) that guests on this site get.
 * The calculation itself lives in price-math.ts (shared with the admin price calendar).
 */
export type { PriceDefaults, PriceList, PricePeriod } from "./price-math";
export { DEFAULT_DISCOUNT, discountLabel, guestNightPrice, minimumNights, nightDiscount, nightlyPrice, priceFromList, stayDiscount } from "./price-math";

type DefaultRow = { property: PropertyId; nightly: string | null; cleaning: string; min_nights: number | null; included_guests: number | null; extra_guest: string | null; discount: string | null };
type PeriodRow = { id: number; property: PropertyId; date_from: string; date_to: string; nightly: string; label: string; min_nights: number | null; discount: string | null };

export async function getPriceList(): Promise<PriceList> {
  const [defaults, periods] = await Promise.all([
    q<DefaultRow>("select property, nightly, cleaning, min_nights, included_guests, extra_guest, discount from price_defaults"),
    q<PeriodRow>(
      `select id, property, to_char(date_from, 'YYYY-MM-DD') as date_from, to_char(date_to, 'YYYY-MM-DD') as date_to, nightly, label, min_nights, discount
       from price_periods order by property, date_from, id`,
    ),
  ]);
  const base = (property: PropertyId): PriceDefaults => {
    const row = defaults.find((d) => d.property === property);
    return {
      property,
      nightly: row?.nightly == null ? null : Number(row.nightly),
      cleaning: row ? Number(row.cleaning) : 0,
      minNights: row?.min_nights ?? 1,
      includedGuests: row?.included_guests ?? null,
      extraGuest: row?.extra_guest == null ? 0 : Number(row.extra_guest),
      discount: row?.discount == null ? DEFAULT_DISCOUNT : Number(row.discount),
    };
  };
  return {
    defaults: { kaja: base("kaja"), janis: base("janis") },
    periods: periods.map((p) => ({
      id: p.id,
      property: p.property,
      from: p.date_from,
      to: p.date_to,
      nightly: Number(p.nightly),
      label: p.label,
      minNights: p.min_nights ?? null,
      discount: p.discount == null ? null : Number(p.discount),
    })),
  };
}

export async function setDefaults(
  property: PropertyId,
  values: { nightly: number | null; cleaning: number; minNights: number; includedGuests: number | null; extraGuest: number; discount: number },
  by: string,
) {
  await q(
    `insert into price_defaults (property, nightly, cleaning, min_nights, included_guests, extra_guest, discount, updated_by) values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (property) do update set nightly = excluded.nightly, cleaning = excluded.cleaning, min_nights = excluded.min_nights,
       included_guests = excluded.included_guests, extra_guest = excluded.extra_guest, discount = excluded.discount, updated_by = excluded.updated_by, updated_at = now()`,
    [property, values.nightly, values.cleaning, values.minNights, values.includedGuests, values.extraGuest, values.discount, by],
  );
}

export async function addPeriod(period: Omit<PricePeriod, "id">, by: string) {
  await q("insert into price_periods (property, date_from, date_to, nightly, label, min_nights, discount, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8)", [
    period.property,
    period.from,
    period.to,
    period.nightly,
    period.label,
    period.minNights,
    period.discount,
    by,
  ]);
}

/**
 * Removes the nights from..to (inclusive) from every special price of a house: periods fully inside are
 * deleted, periods sticking out are shortened, and a period covering both sides is split in two.
 */
async function trimPeriods(client: PoolClient, property: PropertyId, from: string, to: string) {
  const { rows } = await client.query<{ id: number; date_from: string; date_to: string }>(
    `select id, to_char(date_from, 'YYYY-MM-DD') as date_from, to_char(date_to, 'YYYY-MM-DD') as date_to
     from price_periods where property = $1 and date_from <= $3::date and date_to >= $2::date for update`,
    [property, from, to],
  );
  for (const row of rows) {
    const keepBefore = row.date_from < from;
    const keepAfter = row.date_to > to;
    if (!keepBefore && !keepAfter) {
      await client.query("delete from price_periods where id = $1", [row.id]);
    } else if (keepBefore && keepAfter) {
      await client.query(
        `insert into price_periods (property, date_from, date_to, nightly, label, min_nights, discount, created_by)
         select property, $2::date + 1, date_to, nightly, label, min_nights, discount, created_by from price_periods where id = $1`,
        [row.id, to],
      );
      await client.query("update price_periods set date_to = $2::date - 1 where id = $1", [row.id, from]);
    } else if (keepBefore) {
      await client.query("update price_periods set date_to = $2::date - 1 where id = $1", [row.id, from]);
    } else {
      await client.query("update price_periods set date_from = $2::date + 1 where id = $1", [row.id, to]);
    }
  }
}

/** Sets one price for the nights from..to (admin calendar selection), replacing special prices on those nights. */
export async function setRange(period: Omit<PricePeriod, "id">, by: string) {
  await tx(async (client) => {
    await trimPeriods(client, period.property, period.from, period.to);
    await client.query("insert into price_periods (property, date_from, date_to, nightly, label, min_nights, discount, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8)", [
      period.property,
      period.from,
      period.to,
      period.nightly,
      period.label,
      period.minNights,
      period.discount,
      by,
    ]);
  });
}

/** Puts the nights from..to back on the standard price. */
export async function clearRange(property: PropertyId, from: string, to: string) {
  await tx((client) => trimPeriods(client, property, from, to));
}

export async function deletePeriod(id: number) {
  const rows = await q("delete from price_periods where id = $1 returning id", [id]);
  return rows.length === 1;
}

/** Each house's standard direct-booking discount (%), for the "save N%" texts on the site. */
export async function houseDiscounts(): Promise<Record<PropertyId, number>> {
  const fallback = { kaja: DEFAULT_DISCOUNT, janis: DEFAULT_DISCOUNT } as Record<PropertyId, number>;
  if (!dbConfigured()) return fallback;
  try {
    const rows = await q<{ property: PropertyId; discount: string }>("select property, discount from price_defaults");
    for (const row of rows) fallback[row.property] = Number(row.discount);
  } catch (error) {
    console.warn("Discounts unavailable", (error as Error).message);
  }
  return fallback;
}

