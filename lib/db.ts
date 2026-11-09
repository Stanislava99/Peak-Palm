import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Postgres (Neon) — one database per site: the test project and the live project each get their own.
 * Vercel's Neon integration sets DATABASE_URL (pooled). Tables are created automatically on first use.
 *
 * What lives here: bookings and guests, a history of every change, which emails went out,
 * guest reviews, questions from the website, temporary date holds while a guest pays,
 * one-time sign-in links and rate limits. Stripe stays the record for money (payments, refunds,
 * payouts) and keeps a backup of each booking's status in the payment's metadata.
 */
let pool: Pool | null = null;
let ready: Promise<void> | null = null;

/**
 * The connection string. Vercel's Neon integration names it DATABASE_URL, or <PREFIX>_DATABASE_URL
 * when a custom prefix was chosen (here SEA_SKI_TEST_… on the test project, SEA_SKI_PROD_… on live).
 * As a guard, the test site never uses a "PROD" database and the live site never uses a "TEST" one.
 */
export function databaseEnvKey(): string | null {
  const env = process.env;
  const candidates = ["DATABASE_URL", "POSTGRES_URL"];
  const prefixed = Object.keys(env)
    .filter((k) => /^[A-Z0-9_]+_DATABASE_URL$/.test(k))
    .sort();
  const testSite = (env.APP_ENV ?? "").trim().toLowerCase() === "test";
  for (const key of [...candidates, ...prefixed]) {
    if (!env[key]?.trim()) continue;
    if (testSite && /PROD|LIVE/.test(key)) continue;
    if (!testSite && /TEST/.test(key)) continue;
    return key;
  }
  return null;
}

export function dbConfigured() {
  return databaseEnvKey() !== null;
}

function connectionString() {
  const key = databaseEnvKey();
  return key ? (process.env[key] ?? "").trim() : "";
}

function getPool() {
  if (pool) return pool;
  const url = connectionString();
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
  pool = new Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: local ? undefined : { rejectUnauthorized: true },
  });
  pool.on("error", (error) => console.error("Database pool error", error.message));
  return pool;
}

const SCHEMA = `
create table if not exists bookings (
  ref text primary key,
  property text not null check (property in ('kaja', 'janis')),
  check_in date not null,
  check_out date not null,
  guests int not null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null default '',
  arrival text not null default '',
  note text not null default '',
  airbnb_total numeric(10,2),
  direct_total numeric(10,2) not null,
  deposit numeric(10,2) not null,
  balance numeric(10,2) not null,
  status text not null check (status in ('awaiting_payment','pending','confirmed','declined','expired','payment_failed','cancelled')),
  stripe_house text not null,
  stripe_session_id text unique,
  stripe_payment_intent text unique,
  hold_until timestamptz,
  deposit_paid_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by text,
  declined_at timestamptz,
  declined_by text,
  refund_id text,
  refunded_at timestamptz,
  balance_cash_at timestamptz,
  balance_cash_by text,
  review_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in)
);
create index if not exists bookings_by_dates on bookings (property, check_in, check_out);
create index if not exists bookings_by_status on bookings (status);

create table if not exists booking_events (
  id bigserial primary key,
  ref text not null,
  at timestamptz not null default now(),
  actor text not null,
  type text not null,
  detail jsonb
);
create index if not exists booking_events_by_ref on booking_events (ref, at);

create table if not exists emails (
  id bigserial primary key,
  ref text not null,
  kind text not null,
  recipients text not null default '',
  status text not null check (status in ('sending','sent','failed')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (ref, kind)
);

create table if not exists reviews (
  ref text primary key references bookings(ref) on delete cascade,
  property text not null,
  name text not null,
  rating int not null check (rating between 1 and 5),
  text text not null,
  status text not null check (status in ('pending','published','hidden')),
  submitted_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by text
);

create table if not exists questions (
  id bigserial primary key,
  property text,
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists login_tokens (
  nonce text primary key,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz not null default now()
);

create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- Offers by email: the guest ticks an optional box at checkout (stored on the booking);
-- unsubscribing or a host removing them is recorded here, per email address.
alter table bookings add column if not exists marketing_opt_in_at timestamptz;
create table if not exists marketing_optouts (
  email text primary key,
  at timestamptz not null default now(),
  source text not null default 'guest'
);

create table if not exists app_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
`;

/**
 * Creates the tables if they're missing. One transaction with a transaction-level lock, so it is
 * safe when several server instances start at once, and with Neon's connection pooler.
 */
async function migrate() {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(727272)");
    await client.query(SCHEMA);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureDb() {
  if (!ready) {
    ready = migrate().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

export async function q<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureDb();
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function tx<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureDb();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const out = await work(client);
    await client.query("commit");
    return out;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Housekeeping: drop expired sign-in tokens and old rate-limit windows (cheap, runs occasionally). */
export async function tidyDb() {
  await q("delete from login_tokens where expires_at < now() - interval '1 day'");
  await q("delete from rate_limits where window_start < now() - interval '2 days'");
  await q("update bookings set status = 'expired', updated_at = now() where status = 'awaiting_payment' and hold_until < now() - interval '2 days'");
  // Data minimisation (see the privacy notice): checkouts that were never paid are deleted after
  // 30 days, and questions from the website after 2 years.
  await q(
    `with gone as (
       delete from bookings where status in ('awaiting_payment','expired','payment_failed') and deposit_paid_at is null
         and created_at < now() - interval '30 days' returning ref)
     delete from booking_events where ref in (select ref from gone)`,
  );
  await q("delete from questions where created_at < now() - interval '2 years'");
}
