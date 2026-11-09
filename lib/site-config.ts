import { isTestMode } from "./stripe";

/**
 * Which environment this deployment is.
 * - "test": the test site (Stripe test mode, TEST banner, not indexed, extra notification recipients).
 * - "production": the live site.
 * Set APP_ENV explicitly in Vercel; otherwise a Stripe test key means "test".
 */
export type AppEnv = "test" | "production";

export function appEnv(): AppEnv {
  const explicit = process.env.APP_ENV?.trim().toLowerCase();
  if (explicit === "test" || explicit === "production") return explicit;
  return isTestMode() ? "test" : "production";
}

export const isTestSite = () => appEnv() === "test";

/** The official bookings inbox. */
export const OFFICIAL_EMAIL = "regalo1996@yahoo.com";
const TEST_EXTRA = ["stanislava.ilievska@gmail.com"];
/** Extra people who can sign in to /admin on the TEST site only. */
const TEST_ADMINS = ["kaja.lazova@hotmail.com"];

function list(value: string | undefined) {
  return (value ?? "")
    .split(/[,;\s]+/)
    .map((v) => v.trim().toLowerCase())
    .filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
}

/** Who gets booking notifications. Override with NOTIFY_EMAILS (comma-separated). */
export function notifyEmails(): string[] {
  const configured = list(process.env.NOTIFY_EMAILS);
  if (configured.length) return configured;
  return isTestSite() ? [OFFICIAL_EMAIL, ...TEST_EXTRA] : [OFFICIAL_EMAIL];
}

/** Who can sign in to /admin. Override with ADMIN_EMAILS (comma-separated). */
export function adminEmails(): string[] {
  const configured = list(process.env.ADMIN_EMAILS);
  if (configured.length) return configured;
  return isTestSite() ? [OFFICIAL_EMAIL, ...TEST_EXTRA, ...TEST_ADMINS] : [OFFICIAL_EMAIL, ...TEST_EXTRA];
}

/** Where guests reply to. */
export function contactEmail() {
  return list(process.env.CONTACT_EMAIL)[0] ?? OFFICIAL_EMAIL;
}

/**
 * Business details printed on the PDF confirmation. Fill these in (Vercel env) once you have them.
 * Without a legal name and tax number the PDF is a booking confirmation and receipt,
 * not a tax invoice. Check BG/GR invoicing rules with your accountant.
 */
export function businessDetails() {
  return {
    tradingName: "Sea & Ski Villas",
    legalName: process.env.BUSINESS_LEGAL_NAME?.trim() || "",
    address: process.env.BUSINESS_ADDRESS?.trim() || "",
    taxId: process.env.BUSINESS_TAX_ID?.trim() || "",
    email: contactEmail(),
  };
}
