import Stripe from "stripe";
import type { PropertyId } from "./properties";

/**
 * One Stripe account per house, so each house is paid into its own bank account:
 *   STRIPE_SECRET_KEY_KAJA   → Villa Kaja (e.g. the Bulgarian account)
 *   STRIPE_SECRET_KEY_JANIS  → Jani’s Beach House (e.g. the Greek account)
 * STRIPE_SECRET_KEY is the fallback for any house without its own key (one shared account).
 * Keys are server-only and never sent to the browser.
 */
const HOUSES: PropertyId[] = ["kaja", "janis"];
const KEY_SHAPE = /^(sk|rk)_(test|live)_/;

export function secretKeyFor(house: PropertyId) {
  const own = process.env[`STRIPE_SECRET_KEY_${house.toUpperCase()}`]?.trim();
  return own || process.env.STRIPE_SECRET_KEY?.trim() || "";
}

function configuredKeys() {
  return [...new Set(HOUSES.map(secretKeyFor).filter((k) => KEY_SHAPE.test(k)))];
}

/** True when every configured key is a test key (no live key anywhere). */
export function isTestMode() {
  const keys = configuredKeys();
  return keys.length > 0 && keys.every((k) => /^(sk|rk)_test_/.test(k));
}

/**
 * STRIPE_API_HOST points the clients at a local mock server for automated tests.
 * It is ignored unless every key is a test key, so it can never redirect real payments.
 */
export function usingMockStripe() {
  return Boolean(process.env.STRIPE_API_HOST?.trim()) && isTestMode();
}

const clients = new Map<string, Stripe>();
const accountOf = new WeakMap<object, Stripe>();

function clientForKey(key: string): Stripe | null {
  if (!key) return null;
  if (!KEY_SHAPE.test(key)) {
    console.error("A STRIPE_SECRET_KEY value doesn’t look like a Stripe secret or restricted key; payments are off for it.");
    return null;
  }
  const hit = clients.get(key);
  if (hit) return hit;
  const [host, port] = usingMockStripe() ? process.env.STRIPE_API_HOST!.trim().split(":") : [];
  const client = new Stripe(key, {
    appInfo: { name: "Sea & Ski Villas" },
    maxNetworkRetries: 2,
    timeout: 20_000,
    ...(host ? { host, port: Number(port) || 80, protocol: "http" as const } : {}),
  });
  clients.set(key, client);
  return client;
}

/** The Stripe account for a house; without a house, the first configured account. */
export function getStripe(house?: PropertyId): Stripe | null {
  if (house) return clientForKey(secretKeyFor(house));
  for (const h of HOUSES) {
    const c = clientForKey(secretKeyFor(h));
    if (c) return c;
  }
  return null;
}

/** Every distinct Stripe account in use, with the houses it serves. */
export function stripeAccounts(): Array<{ stripe: Stripe; houses: PropertyId[]; live: boolean }> {
  const byKey = new Map<string, { stripe: Stripe; houses: PropertyId[]; live: boolean }>();
  for (const h of HOUSES) {
    const key = secretKeyFor(h);
    const stripe = clientForKey(key);
    if (!stripe) continue;
    const entry = byKey.get(key) ?? { stripe, houses: [], live: /_live_/.test(key) };
    entry.houses.push(h);
    byKey.set(key, entry);
  }
  return [...byKey.values()];
}

export function paymentsEnabled(house?: PropertyId) {
  return house ? KEY_SHAPE.test(secretKeyFor(house)) : configuredKeys().length > 0;
}

/** Remembers which account an object (payment, session) was read from. */
export function rememberAccount<T extends object>(obj: T, stripe: Stripe): T {
  accountOf.set(obj, stripe);
  return obj;
}
export function stripeOf(obj: object): Stripe | null {
  return accountOf.get(obj) ?? null;
}

function missing(error: unknown) {
  const e = error as { code?: string; statusCode?: number };
  return e?.code === "resource_missing" || e?.statusCode === 404;
}

/** Finds a payment in whichever house’s account holds it. */
export async function findIntent(id: string): Promise<{ stripe: Stripe; intent: Stripe.PaymentIntent } | null> {
  for (const { stripe } of stripeAccounts()) {
    try {
      const intent = await stripe.paymentIntents.retrieve(id);
      return { stripe, intent: rememberAccount(intent, stripe) };
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  return null;
}

/** Finds a Checkout Session in whichever account created it. */
export async function findSession(id: string, expand?: string[]) {
  for (const { stripe } of stripeAccounts()) {
    try {
      const session = await stripe.checkout.sessions.retrieve(id, expand ? { expand } : undefined);
      return { stripe, session };
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  return null;
}

/** Webhook signing secrets, each tied to the house(s) of the account it belongs to. */
export function webhookSecrets(): Array<{ secret: string; stripe: Stripe | null }> {
  const out: Array<{ secret: string; stripe: Stripe | null }> = [];
  for (const h of HOUSES) {
    const secret = process.env[`STRIPE_WEBHOOK_SECRET_${h.toUpperCase()}`]?.trim();
    if (secret) out.push({ secret, stripe: getStripe(h) });
  }
  const shared = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (shared) out.push({ secret: shared, stripe: getStripe() });
  return out;
}
