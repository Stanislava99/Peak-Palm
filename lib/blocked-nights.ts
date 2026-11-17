import type { PoolClient } from "pg";
import { dbConfigured, q, tx } from "./db";
import type { PropertyId } from "./properties";
import { eachNight } from "./stay";

/**
 * Nights the hosts close on this site from admin (repairs, own use, a booking taken by phone).
 * Guests can't book them here. They are NOT sent to Airbnb or Booking.com: block those there too.
 */
export type BlockedRange = { id: number; property: PropertyId; from: string; to: string; note: string };

type Row = { id: number; property: PropertyId; date_from: string; date_to: string; note: string };

export async function listBlocked(property?: PropertyId): Promise<BlockedRange[]> {
  if (!dbConfigured()) return [];
  const rows = await q<Row>(
    `select id, property, to_char(date_from, 'YYYY-MM-DD') as date_from, to_char(date_to, 'YYYY-MM-DD') as date_to, note
     from blocked_nights where ($1::text is null or property = $1) and date_to >= current_date - 1 order by property, date_from`,
    [property ?? null],
  );
  return rows.map((r) => ({ id: r.id, property: r.property, from: r.date_from, to: r.date_to, note: r.note }));
}

/** Every blocked night of a house (for the calendar). Never throws: a database hiccup must not hide the calendar. */
export async function blockedNights(property: PropertyId): Promise<Set<string>> {
  try {
    const nights = new Set<string>();
    for (const range of await listBlocked(property)) {
      for (const night of eachNight(range.from, addDay(range.to))) nights.add(night);
    }
    return nights;
  } catch (error) {
    console.warn("Blocked nights unavailable", (error as Error).message);
    return new Set();
  }
}

function addDay(iso: string) {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** Removes from..to from existing blocks of a house (deleting, shortening or splitting them). */
async function trim(client: PoolClient, property: PropertyId, from: string, to: string) {
  const { rows } = await client.query<{ id: number; date_from: string; date_to: string }>(
    `select id, to_char(date_from, 'YYYY-MM-DD') as date_from, to_char(date_to, 'YYYY-MM-DD') as date_to
     from blocked_nights where property = $1 and date_from <= $3::date and date_to >= $2::date for update`,
    [property, from, to],
  );
  for (const row of rows) {
    const before = row.date_from < from;
    const after = row.date_to > to;
    if (!before && !after) await client.query("delete from blocked_nights where id = $1", [row.id]);
    else if (before && after) {
      await client.query(
        `insert into blocked_nights (property, date_from, date_to, note, created_by)
         select property, $2::date + 1, date_to, note, created_by from blocked_nights where id = $1`,
        [row.id, to],
      );
      await client.query("update blocked_nights set date_to = $2::date - 1 where id = $1", [row.id, from]);
    } else if (before) await client.query("update blocked_nights set date_to = $2::date - 1 where id = $1", [row.id, from]);
    else await client.query("update blocked_nights set date_from = $2::date + 1 where id = $1", [row.id, to]);
  }
}

/** Blocks the nights from..to (inclusive), replacing any blocks already on them (so they never overlap). */
export async function blockRange(property: PropertyId, from: string, to: string, note: string, by: string) {
  await tx(async (client) => {
    await trim(client, property, from, to);
    await client.query("insert into blocked_nights (property, date_from, date_to, note, created_by) values ($1, $2, $3, $4, $5)", [property, from, to, note, by]);
  });
}

/** Opens the nights from..to again. */
export async function unblockRange(property: PropertyId, from: string, to: string) {
  await tx((client) => trim(client, property, from, to));
}

export async function deleteBlock(id: number) {
  const rows = await q("delete from blocked_nights where id = $1 returning id", [id]);
  return rows.length === 1;
}
