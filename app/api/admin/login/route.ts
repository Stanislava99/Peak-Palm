import { emailConfigured, sendEmail } from "@/lib/email";
import { adminLoginLink } from "@/lib/email-templates";
import {
  HOST_COOKIE,
  createLoginToken,
  createSession,
  passwordLoginEnabled,
  passwordMatches,
  sessionCookie,
  totpMatches,
  totpRequired,
} from "@/lib/host-auth";
import { NO_STORE, clientIp, deny, guard, rateLimit } from "@/lib/security";
import { adminEmails } from "@/lib/site-config";
import { NextResponse } from "next/server";

type Body = { email?: string; password?: string; code?: string; logout?: boolean };

export async function POST(request: Request) {
  const blocked = guard(request, "admin-login", [
    [5, 15 * 60_000],
    [20, 24 * 3600_000],
  ]);
  if (blocked) return blocked;

  const body = (await request.json().catch(() => null)) as Body | null;
  if (body?.logout) {
    const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
    response.cookies.set(HOST_COOKIE, "", { ...sessionCookie, maxAge: 0 });
    return response;
  }
  if (!rateLimit("admin-login:global", 30, 15 * 60_000)) return deny("Too many attempts. Please wait a few minutes.", 429);

  // 1) Email sign-in link (preferred)
  if (typeof body?.email === "string") {
    const email = body.email.trim().toLowerCase().slice(0, 160);
    const generic = NextResponse.json(
      { ok: true, message: "If this address has access, a sign-in link is on its way. It works for 15 minutes." },
      { headers: NO_STORE },
    );
    if (!emailConfigured()) return deny("Email isn’t set up yet. Use the password instead.", 503);
    if (!rateLimit(`admin-link:${email}`, 5, 3600_000)) return generic;
    if (adminEmails().includes(email)) {
      const origin = new URL(request.headers.get("origin")!).origin;
      const link = `${origin}/admin/verify#t=${createLoginToken(email)}`;
      const sent = await sendEmail({ to: [email], ...adminLoginLink(link) });
      if (!sent.sent) console.error("Admin sign-in link could not be sent", sent.error);
    } else {
      console.warn("Admin sign-in requested for a non-admin address", { ip: clientIp(request) });
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    return generic;
  }

  // 2) Password fallback
  if (!passwordLoginEnabled()) return deny("Sign in with your email address.", 400);
  const ok = typeof body?.password === "string" && passwordMatches(body.password) && totpMatches(body.code ?? "");
  if (!ok) {
    console.warn("Admin password login failed", { ip: clientIp(request), at: new Date().toISOString() });
    await new Promise((resolve) => setTimeout(resolve, 800));
    return deny(totpRequired() ? "Wrong password or code." : "Wrong password.", 401);
  }
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(HOST_COOKIE, createSession("password-login"), sessionCookie);
  return response;
}
