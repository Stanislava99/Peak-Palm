# Payment security — Peak & Palm Villas

## How payments are protected (built into the site)

**Card data never touches this site.** Guests enter card details only on Stripe’s own hosted page
(`checkout.stripe.com`). That keeps the site in the lightest PCI DSS category (**SAQ A**): no card numbers
are ever received, stored or logged here.

| Area | Protection |
|---|---|
| Card payments | Stripe Checkout (PCI DSS Level 1). Cards only, incl. Apple Pay / Google Pay. **3-D Secure required on every payment** (bank verification; also shifts fraud liability to the card issuer). |
| Webhooks | Every Stripe notification is verified with the signing secret; forged calls are rejected. |
| Amounts | Prices are calculated **on the server** from the live Airbnb total; nothing the browser sends can change the amount. Implausible prices (below €60/night Villa Kaja, €40/night Jani’s) are refused. |
| Money flow | The 50% deposit is paid at checkout; the booking stays pending until the host confirms on `/admin`. Declining refunds the deposit in full automatically. |
| Double charging | Stripe idempotency keys on refunds and balance charges; balance can’t be charged twice (checked against Stripe). |
| Double booking | Dates are re-checked against Airbnb, Booking.com and existing holds right before payment; accepting a booking that overlaps a confirmed one is refused. |
| Card-testing bots | Rate limits (6 checkout attempts / 10 min, 20 / day per address), hidden honeypot field, same-site checks, 3-D Secure. |
| Admin page `/admin` | One-time email sign-in link (15 min, single use, only for the listed admin addresses) + 6-digit authenticator code (TOTP); HMAC-signed session cookie (`__Host-`, Secure, HttpOnly, SameSite=Strict), 12-hour expiry; rate-limited; sign-ins logged. |
| Cross-site attacks | Every state-changing API checks the request comes from this site (CSRF). |
| Browser hardening | Strict Content-Security-Policy (nonce-based on checkout and host pages, no third-party scripts anywhere), HSTS with preload, no framing (clickjacking), nosniff, strict referrer policy, Permissions-Policy, private pages not cached or indexed. |
| Secrets | Stripe key is server-only (never sent to the browser); `.env*` files are git-ignored. |
| Dependencies | `npm audit` clean (PostCSS pinned to a patched version via `overrides`). Run `npm audit` before each deploy. |

## Your checklist (accounts and settings only you can change)

**Stripe**
1. Two-step verification on your Stripe login (Settings → Personal details → Two-step authentication), ideally with a passkey or authenticator app, not SMS.
2. Use a **restricted API key** instead of the full secret key: Developers → API keys → *Create restricted key* with only
   - Checkout Sessions: **Write**
   - PaymentIntents: **Write**
   - Refunds: **Write** (used when you decline a booking)
   - Customers: **Read**
   - everything else: **None**

   Test the whole flow in test mode first; if a step fails, Stripe’s error names the missing permission.
3. Radar (Payments → Fraud & risk → Rules): turn on **Block if CVC verification fails** and **Block if postal code verification fails**; keep the default high-risk blocking on.
4. Settings → Compliance: complete the yearly **PCI SAQ A** questionnaire (Stripe pre-fills it).
5. Payouts go only to your verified business bank account; turn on email alerts for payouts and disputes.

**Vercel**
1. Two-step verification on your Vercel (and GitHub/Cursor) login.
2. Add environment variables as **Sensitive** (Settings → Environment Variables). Production only for live keys; use test keys for Preview.
3. Firewall → add a **rate-limit rule**: path `/api/checkout` and `/api/admin/login`, e.g. 10 requests / minute per IP. (The site’s own limits are per server instance; this makes them global.)
4. Keep Deployment Protection on for Preview deployments (only Production is public).

**Admin page**
1. Protect the two admin mailboxes (regalo1996@yahoo.com, stanislava.ilievska@gmail.com) with two-step verification, because sign-in links go there.
2. Run `npm run host:2fa`, add the secret to an authenticator app, and set `HOST_TOTP_SECRET`.
3. Only open `/admin` on your own devices; log out on shared computers.

**Domain**
Once you have your own domain, submit it at hstspreload.org so browsers always use HTTPS.
