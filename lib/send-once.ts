import { randomBytes } from "crypto";
import type Stripe from "stripe";
import { dbConfigured } from "./db";

const CLAIM_MS = 60_000;
const SETTLE_MS = 600;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `job` (sending an email) at most once per payment and flag, even when two requests arrive at
 * the same moment (a double click, two admins, or Stripe delivering the same event twice).
 * There's no database, so the lock lives on the payment's metadata in Stripe:
 *   1. already sent (flag set) → skip
 *   2. someone else claimed it in the last minute → skip
 *   3. write our own claim token, wait a moment, read it back: only the request whose token
 *      survived goes ahead (the other one sees a different token and stops)
 * Returns true if the email has been sent (now or earlier) or is being sent by the other request.
 */
export async function sendOnce(stripe: Stripe, intentId: string, flag: string, job: () => Promise<boolean>, options: { force?: boolean } = {}): Promise<boolean> {
  if (dbConfigured()) return sendOnceDb(stripe, intentId, flag, job, Boolean(options.force));
  if (options.force) {
    const ok = await job().catch(() => false);
    if (ok) await stripe.paymentIntents.update(intentId, { metadata: { [flag]: new Date().toISOString() } });
    return ok;
  }
  const claimKey = `${flag}Claim`;
  const fresh = await stripe.paymentIntents.retrieve(intentId);
  if (fresh.metadata?.[flag]) return true;
  const existing = fresh.metadata?.[claimKey];
  if (existing && Date.now() - Number(existing.split("-")[0]) < CLAIM_MS) return true;

  const token = `${Date.now()}-${randomBytes(6).toString("hex")}`;
  await stripe.paymentIntents.update(intentId, { metadata: { [claimKey]: token } });
  await wait(SETTLE_MS);
  const check = await stripe.paymentIntents.retrieve(intentId);
  if (check.metadata?.[flag]) return true;
  if (check.metadata?.[claimKey] !== token) return true;

  const ok = await job().catch(() => false);
  await stripe.paymentIntents.update(intentId, {
    metadata: ok ? { [flag]: new Date().toISOString(), [claimKey]: "" } : { [claimKey]: "" },
  });
  return ok;
}

/** Email kinds in the database's emails table, by the flag name used on the Stripe payment. */
export const EMAIL_KIND: Record<string, string> = {
  mailedRequest: "hosts_new",
  mailedGuestPending: "guest_pending",
  mailedConfirmed: "confirmed",
  mailedDeclined: "declined",
  reviewReceived: "review_received",
  mailedBalance: "balance_paid",
  mailedBalanceFailed: "balance_failed",
  mailedReviewRequest: "review_request",
};

/**
 * With the database: one row per booking and email kind, claimed atomically (insert … on conflict),
 * so exactly one request sends it. The flag is still written on the payment as a backup record.
 */
async function sendOnceDb(stripe: Stripe, intentId: string, flag: string, job: () => Promise<boolean>, force: boolean) {
  const { claimEmail, finishEmail } = await import("./booking-store");
  const intent = await stripe.paymentIntents.retrieve(intentId);
  const ref = intent.metadata?.ref || intentId;
  const id = await claimEmail(ref, EMAIL_KIND[flag] ?? flag, intent.metadata?.email ?? "", force);
  if (id === null) return true; // already sent, or being sent by another request right now
  let ok = false;
  let error: string | undefined;
  try {
    ok = await job();
  } catch (e) {
    error = (e as Error).message;
  }
  await finishEmail(id, ok, ok ? undefined : error ?? "not sent");
  if (ok) await stripe.paymentIntents.update(intentId, { metadata: { [flag]: new Date().toISOString() } }).catch(() => {});
  return ok;
}
