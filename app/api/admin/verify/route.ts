import { HOST_COOKIE, consumeLoginToken, createSession, sessionCookie, totpMatches } from "@/lib/host-auth";
import { NO_STORE, deny, guard } from "@/lib/security";
import { adminEmails } from "@/lib/site-config";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const blocked = await guard(request, "admin-verify", [[10, 15 * 60_000]]);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => null)) as { token?: string; code?: string } | null;
  if (!body?.token) return deny("This sign-in link isn’t valid.", 400);

  // Check the code first so a wrong code doesn't burn the one-time link.
  if (!totpMatches(body.code ?? "")) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return deny("Wrong code. Try the newest code from your authenticator app.", 401);
  }
  const email = await consumeLoginToken(body.token);
  if (!email || !adminEmails().includes(email)) {
    return deny("This sign-in link has expired or was already used. Request a new one.", 401);
  }
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(HOST_COOKIE, createSession(email), sessionCookie);
  console.info("Admin signed in", { email, at: new Date().toISOString() });
  return response;
}
