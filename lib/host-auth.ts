import { dbConfigured } from "./db";
import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Admin login for /admin: one-time email links for ADMIN_EMAILS (or HOST_PASSWORD as fallback).
 * - HOST_PASSWORD: at least 12 characters, or the page stays locked.
 * - HOST_TOTP_SECRET (recommended): base32 secret for an authenticator app (6-digit code).
 * - Sessions are HMAC-signed, expire after 12 hours, and use a __Host- cookie
 *   (Secure, HttpOnly, SameSite=Strict) in production. Changing the password or the
 *   Stripe key signs everyone out.
 */
const SESSION_HOURS = 12;
export const HOST_COOKIE = process.env.NODE_ENV === "production" ? "__Host-pp_admin" : "pp_admin";
export const SESSION_MAX_AGE = SESSION_HOURS * 3600;
const MIN_PASSWORD = 12;

function password() {
  return process.env.HOST_PASSWORD?.trim() ?? "";
}

export function hostConfigured() {
  return password().length >= MIN_PASSWORD;
}

export function passwordLoginEnabled() {
  return hostConfigured();
}

export function hostSetupProblem(emailLogin: boolean): string | null {
  if (emailLogin) return null;
  if (!password()) return "Set up email (or HOST_PASSWORD) in the environment settings to turn this page on.";
  if (password().length < MIN_PASSWORD) return `HOST_PASSWORD must be at least ${MIN_PASSWORD} characters.`;
  return null;
}

export function totpRequired() {
  return Boolean(totpSecretFromEnv(process.env.HOST_TOTP_SECRET));
}

function signingKey() {
  const material = `${password()}|${process.env.STRIPE_SECRET_KEY ?? ""}|${process.env.HOST_TOTP_SECRET ?? ""}|${process.env.ADMIN_SESSION_SECRET ?? ""}`;
  return Buffer.from(hkdfSync("sha256", material, "peakandpalm-host", "session-v1", 32));
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function passwordMatches(input: string) {
  if (!hostConfigured()) return false;
  const key = signingKey();
  const a = createHmac("sha256", key).update(input).digest("hex");
  const b = createHmac("sha256", key).update(password()).digest("hex");
  return safeEqual(a, b);
}

/* ── TOTP (RFC 6238, SHA-1, 30 s, 6 digits) ── */
function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpAt(secret: Buffer, counter: number) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

/**
 * Accepts the secret however it was pasted: the bare secret, with spaces or lowercase,
 * the whole "HOST_TOTP_SECRET=…" line, or the otpauth:// link.
 */
export function totpSecretFromEnv(value: string | undefined) {
  let raw = (value ?? "").trim().replace(/^["']|["']$/g, "");
  const fromLink = raw.match(/[?&]secret=([A-Za-z2-7=\s]+)/);
  if (fromLink) raw = decodeURIComponent(fromLink[1]);
  raw = raw.replace(/^HOST_TOTP_SECRET\s*=\s*/i, "");
  return raw.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

export function totpMatches(input: string) {
  const raw = totpSecretFromEnv(process.env.HOST_TOTP_SECRET);
  if (!raw) return true;
  const code = input.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(raw);
  const step = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((drift) => safeEqual(totpAt(secret, step + drift), code));
}

/* ── Signed sessions (carry the admin’s email) ── */
const b64 = (v: string) => Buffer.from(v).toString("base64url");
const unb64 = (v: string) => Buffer.from(v, "base64url").toString();

function sign(payload: string) {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function createSession(email: string) {
  const payload = `s.${Math.floor(Date.now() / 1000) + SESSION_MAX_AGE}.${randomBytes(12).toString("hex")}.${b64(email)}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "s") return null;
  const payload = parts.slice(0, 4).join(".");
  if (!safeEqual(parts[4], sign(payload))) return null;
  if (Number(parts[1]) * 1000 <= Date.now()) return null;
  return unb64(parts[3]);
}

export async function currentAdmin(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(HOST_COOKIE)?.value);
}

export async function isHost() {
  return Boolean(await currentAdmin());
}

/* ── One-time sign-in links (15 minutes, single use) ── */
const LINK_MINUTES = 15;
const usedLinks = new Map<string, number>();

export function createLoginToken(email: string) {
  const payload = `l.${Math.floor(Date.now() / 1000) + LINK_MINUTES * 60}.${randomBytes(16).toString("hex")}.${b64(email)}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Checks a sign-in link and marks it used. With the database the "used" mark is shared by every
 * server instance (a link works exactly once); without it, it is remembered per instance.
 */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "l") return null;
  const payload = parts.slice(0, 4).join(".");
  if (!safeEqual(parts[4], sign(payload))) return null;
  const exp = Number(parts[1]) * 1000;
  if (exp <= Date.now()) return null;
  if (usedLinks.has(parts[2])) return null;
  if (dbConfigured()) {
    const { q } = await import("./db");
    const rows = await q("insert into login_tokens (nonce, email, expires_at) values ($1, $2, $3) on conflict do nothing returning nonce", [
      parts[2],
      unb64(parts[3]),
      new Date(exp),
    ]);
    if (!rows.length) return null;
  }
  usedLinks.set(parts[2], exp);
  for (const [nonce, until] of usedLinks) if (until < Date.now()) usedLinks.delete(nonce);
  return unb64(parts[3]);
}

export const sessionCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
