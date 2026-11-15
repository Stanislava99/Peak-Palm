import { q } from "./db";
import type { PropertyId } from "./properties";

import type { PriceDefaults, PriceList, PricePeriod } from "./price-math";

/**
 * The hosts' own price list (admin → Prices), stored in the database. Used when Airbnb doesn't
 * return a price. These are the prices guests pay on this site (the direct price), not Airbnb prices.
 * The calculation itself lives in price-math.ts (shared with the admin price calendar).
 */
export type { PriceDefaults, PriceList, PricePeriod } from "./price-math";
export { minimumNights, nightlyPrice, priceFromList } from "./price-math";

type DefaultRow = { property: PropertyId; nightly: string | null; cleaning: string; min_nights: number | null; included_guests: number | null; extra_guest: string | null };
type PeriodRow = { id: number; property: PropertyId; date_from: string; date_to: string; nightly: string; label: string; min_nights: number | null };

export async function getPriceList(): Promise<PriceList> {
  const [defaults, periods] = await Promise.all([
    q<DefaultRow>("select property, nightly, cleaning, min_nights, included_guests, extra_guest from price_defaults"),
    q<PeriodRow>(
      `select id, property, to_char(date_from, 'YYYY-MM-DD') as date_from, to_char(date_to, 'YYYY-MM-DD') as date_to, nightly, label, min_nights
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
    })),
  };
}

export async function setDefaults(
  property: PropertyId,
  values: { nightly: number | null; cleaning: number; minNights: number; includedGuests: number | null; extraGuest: number },
  by: string,
) {
  await q(
    `insert into price_defaults (property, nightly, cleaning, min_nights, included_guests, extra_guest, updated_by) values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (property) do update set nightly = excluded.nightly, cleaning = excluded.cleaning, min_nights = excluded.min_nights,
       included_guests = excluded.included_guests, extra_guest = excluded.extra_guest, updated_by = excluded.updated_by, updated_at = now()`,
    [property, values.nightly, values.cleaning, values.minNights, values.includedGuests, values.extraGuest, by],
  );
}

export async function addPeriod(period: Omit<PricePeriod, "id">, by: string) {
  await q("insert into price_periods (property, date_from, date_to, nightly, label, min_nights, created_by) values ($1, $2, $3, $4, $5, $6, $7)", [
    period.property,
    period.from,
    period.to,
    period.nightly,
    period.label,
    period.minNights,
    by,
  ]);
}

export async function deletePeriod(id: number) {
  const rows = await q("delete from price_periods where id = $1 returning id", [id]);
  return rows.length === 1;
}
