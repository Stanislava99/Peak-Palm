import Stripe from "stripe";

let client: Stripe | null | undefined;

function secretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

/**
 * STRIPE_API_HOST points the client at a local mock server for automated tests.
 * It is ignored for live keys, so a misconfiguration can never send real payments elsewhere.
 */
export function usingMockStripe() {
  return Boolean(process.env.STRIPE_API_HOST?.trim()) && isTestMode();
}

/** Server-side Stripe client, or null while STRIPE_SECRET_KEY is not set. Never sent to the browser. */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = secretKey();
  if (!key) return (client = null);
  if (!/^(sk|rk)_(test|live)_/.test(key)) {
    console.error("STRIPE_SECRET_KEY doesn’t look like a Stripe secret or restricted key; payments are off.");
    return (client = null);
  }
  const [host, port] = usingMockStripe() ? process.env.STRIPE_API_HOST!.trim().split(":") : [];
  client = new Stripe(key, {
    appInfo: { name: "Peak & Palm Villas" },
    maxNetworkRetries: 2,
    timeout: 20_000,
    ...(host ? { host, port: Number(port) || 80, protocol: "http" as const } : {}),
  });
  return client;
}

export function paymentsEnabled() {
  return /^(sk|rk)_(test|live)_/.test(secretKey());
}

export function isTestMode() {
  return /^(sk|rk)_test_/.test(secretKey());
}
