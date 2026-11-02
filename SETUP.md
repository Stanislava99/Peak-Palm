# Test & live environments: setup

| | **Test site** | **Live site** |
|---|---|---|
| Vercel project | `peak-and-palm-test` | `kajastays` |
| Address | https://peak-and-palm-test.vercel.app | your production address (later your own domain) |
| Deploy | `npm run deploy:test` | `npm run deploy:prod` |
| Admin page | `/admin` on the test address | `/admin` on the live address |
| Stripe | **Test mode** keys: no real money, card `4242 4242 4242 4242` | **Live** keys |
| Booking notifications | regalo1996@yahoo.com + stanislava.ilievska@gmail.com | regalo1996@yahoo.com |
| Admin sign-in allowed | regalo1996@yahoo.com, stanislava.ilievska@gmail.com | same |
| Look | red "TEST SITE" label, emails start with [TEST], PDFs say TEST DOCUMENT; hidden from Google | normal |

Recipients and admins are defaults in `lib/site-config.ts`; override per site with `NOTIFY_EMAILS` / `ADMIN_EMAILS`.

---

## 1. Create the test site (once)

```bash
cd ~/Documents/"villa kaja bansko"
npm install
npm run deploy:test        # first run creates the "peak-and-palm-test" project
```

## 2. Email sending (needed for notifications, sign-in links and PDFs)

Pick **one**:

**A. Quick start: a Gmail or Yahoo mailbox with an app password**
- Gmail: Google Account → Security → 2-Step Verification on → *App passwords* → create one.
  `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<the gmail address>`, `SMTP_PASS=<app password>`
- Yahoo (regalo1996@yahoo.com): Account security → *Generate app password*.
  `SMTP_HOST=smtp.mail.yahoo.com`, `SMTP_PORT=465`, `SMTP_USER=regalo1996@yahoo.com`, `SMTP_PASS=<app password>`

**B. Best for the live site: Resend + your own domain** (after you buy peakandpalmvillas.com)
- resend.com → add and verify the domain → create an API key.
  `RESEND_API_KEY=re_…`, `EMAIL_FROM=Peak & Palm Villas <bookings@peakandpalmvillas.com>`

## 3. Stripe webhook (sends the booking emails)

Stripe dashboard → **Developers → Webhooks → Add endpoint** (do it once in *Test mode* for the test site and once in *Live mode* for the live site):
- URL: `https://<site address>/api/stripe/webhook`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
- Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`

## 4. Add the settings to each Vercel project

Add each one as **Sensitive**. Values differ per site:

| Name | Test site | Live site |
|---|---|---|
| `APP_ENV` | `test` | `production` |
| `STRIPE_SECRET_KEY` | `rk_test_…` or `sk_test_…` | `rk_live_…` or `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | test endpoint’s `whsec_…` | live endpoint’s `whsec_…` |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` **or** `RESEND_API_KEY`+`EMAIL_FROM` | from step 2 | from step 2 |
| `HOST_TOTP_SECRET` | from `npm run host:2fa` | from `npm run host:2fa` (a different one) |
| `BOOKING_ICAL_KAJA` | optional | Booking.com export link |
| `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_TAX_ID` | optional | for the PDF footer |

From Terminal, for example:
```bash
npx vercel env add STRIPE_SECRET_KEY production --project peak-and-palm-test --sensitive
npx vercel env add STRIPE_SECRET_KEY production --project kajastays --sensitive
```
(The test site is the test project’s own “production”, which gives it a fixed address. That’s why both use `production` here.)

Then deploy again: `npm run deploy:test` / `npm run deploy:prod`.

## 5. Try it on the test site

1. Open the test address → a house → pick dates → **Continue to checkout** → fill in → pay with `4242 4242 4242 4242`, any future date, any CVC.
2. The deposit is paid right away. Both admin inboxes get **New booking, please confirm**. The guest gets **Deposit received, awaiting confirmation** (dates reserved; full refund if declined).
3. Go to `/admin` → enter your email → open the link → enter the 6-digit code → **Confirm booking & send confirmation**.
4. The guest gets **Booking confirmed** with the PDF; you get a copy. The other 50% is paid **in cash at check-in**: when you receive it, click **Balance received in cash** on `/admin`.
   (**Decline & refund** refunds the deposit in full and tells the guest.)

When everything works on the test site, repeat steps 3–4 with live keys for the live site.
