# Test & live environments: setup

| | **Test site** | **Live site** |
|---|---|---|
| Vercel project | `sea-and-ski-test` | `sea-and-ski-prod` |
| Address | https://peak-and-palm-test.vercel.app (address kept after the rename) | https://kajastays.vercel.app (later your own domain) |
| Deploy | `npm run deploy:test` | `npm run deploy:prod` |
| Admin page | `/admin` on the test address | `/admin` on the live address |
| Stripe | **Test mode** keys: no real money, card `4242 4242 4242 4242` | **Live** keys |
| Booking notifications | regalo1996@yahoo.com + stanislava.ilievska@gmail.com | regalo1996@yahoo.com |
| Admin sign-in allowed | regalo1996@yahoo.com, stanislava.ilievska@gmail.com, kaja.lazova@hotmail.com | regalo1996@yahoo.com, stanislava.ilievska@gmail.com |
| Database (Neon) | its own database: `sea-ski-test` | its own database: `sea-ski-prod` |
| Look | red "TEST SITE" label, emails start with [TEST], PDFs say TEST DOCUMENT; hidden from Google | normal |

Recipients and admins are defaults in `lib/site-config.ts`; override per site with `NOTIFY_EMAILS` / `ADMIN_EMAILS`.

---

## 1. Create the test site (once)

```bash
cd ~/Documents/"villa kaja bansko"
npm install
npm run deploy:test        # deploys to the "sea-and-ski-test" project
```

## 2. Email sending (needed for notifications, sign-in links and PDFs)

Pick **one**:

**A. Quick start: a Gmail or Yahoo mailbox with an app password**
- Gmail: Google Account → Security → 2-Step Verification on → *App passwords* → create one.
  `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<the gmail address>`, `SMTP_PASS=<app password>`
- Yahoo (regalo1996@yahoo.com): Account security → *Generate app password*.
  `SMTP_HOST=smtp.mail.yahoo.com`, `SMTP_PORT=465`, `SMTP_USER=regalo1996@yahoo.com`, `SMTP_PASS=<app password>`

**B. Best for the live site: Resend + your own domain** (after you buy seaandskivillas.com)
- resend.com → add and verify the domain → create an API key.
  `RESEND_API_KEY=re_…`, `EMAIL_FROM=Sea & Ski Villas <bookings@seaandskivillas.com>`

## 3. Stripe: one account per house

Each house is paid into its own Stripe account (Villa Kaja → Bulgarian account and IBAN, Jani’s → Greek account and IBAN). For each account:

- **Test site:** use that account’s **sandbox** (account picker → Switch to sandbox).
- **Live site:** use the account itself (after Stripe has verified it).

In each (sandbox or live):
1. **Restricted key:** API keys → **Create restricted key** → name it “Sea & Ski website” → **Checkout Sessions: Write**, **PaymentIntents: Write**, **Refunds: Write**, everything else **None** → copy the `rk_…` key (shown once).
2. **Webhook:** Workbench → **Webhooks** → **Create an event destination** → Your account → payload **Snapshot** (Thin also works) → events `payment_intent.succeeded` and `payment_intent.payment_failed` → **Webhook endpoint** → URL `https://<site address>/api/stripe/webhook` → copy the signing secret `whsec_…`.

Both accounts use the **same** webhook URL; the site tells them apart by their signing secrets.

## 4. Add the settings to each Vercel project

Add each one as **Sensitive**. Values differ per site:

| Name | Test site (`sea-and-ski-test`) | Live site (`sea-and-ski-prod`) |
|---|---|---|
| `APP_ENV` | `test` | `production` |
| `STRIPE_SECRET_KEY_KAJA` | Villa Kaja sandbox `rk_test_…` | Villa Kaja live `rk_live_…` |
| `STRIPE_WEBHOOK_SECRET_KAJA` | its sandbox webhook `whsec_…` | its live webhook `whsec_…` |
| `STRIPE_SECRET_KEY_JANIS` | Jani’s sandbox `rk_test_…` | Jani’s live `rk_live_…` |
| `STRIPE_WEBHOOK_SECRET_JANIS` | its sandbox webhook `whsec_…` | its live webhook `whsec_…` |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` **or** `RESEND_API_KEY`+`EMAIL_FROM` | from step 2 | from step 2 |
| `HOST_TOTP_SECRET` | from `npm run host:2fa` | from `npm run host:2fa` (a different one) |
| `CRON_SECRET` | `openssl rand -hex 32` | a different one |
| `BOOKING_ICAL_KAJA` | optional | Booking.com export link |
| `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_TAX_ID` | optional | for the PDF footer |

One account for both houses instead? Set only `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Delete the old `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` when you switch to per-house keys, so nothing falls back to the old account by mistake.

From Terminal, for example:
```bash
npx vercel env add STRIPE_SECRET_KEY_KAJA production --project sea-and-ski-test --sensitive
npx vercel env add STRIPE_SECRET_KEY_KAJA production --project sea-and-ski-prod --sensitive
```
(The test site is the test project’s own “production”, which gives it a fixed address. That’s why both use `production` here.)

Then deploy again: `npm run deploy:test` / `npm run deploy:prod`. `/admin` shows which account each house uses (“own account (test)”).

## 4b. Database (Neon), one per site

Bookings, guests, the history of every change, sent emails, guest reviews, questions, sign-in links and rate limits are kept in a Postgres database. Stripe still holds the money and keeps a backup copy of each booking on its payment. Until a database is connected, the site keeps working from Stripe alone.

Do this once for **each** Vercel project (test first, then live). Each one gets its **own** database:

1. Vercel → the project (`sea-and-ski-test`, then `sea-and-ski-prod`) → **Storage** → **Create Database** → **Neon** (Serverless Postgres) → **Continue**.
2. Region: **Frankfurt (eu-central-1)**. Plan: **Free**. Name: `sea-ski-test` (then `sea-ski-prod` for the live project) → **Create**.
3. On the next screen keep **Production** ticked (Preview can stay ticked too) → **Connect**. Vercel adds `DATABASE_URL` (or `<PREFIX>_DATABASE_URL` if you set a prefix; ours are `SEA_SKI_TEST_…` and `SEA_SKI_PROD_…`) and a few other `PG…`/`POSTGRES_…` settings by itself. You don’t copy or paste any password. The test site refuses a database whose setting name contains PROD/LIVE, and the live site one containing TEST.
4. Deploy again: `npm run deploy:test` (then `npm run deploy:prod`).
5. Open `/admin`. It says **Records: kept in the database (Neon)**. The first visit copies in every booking and review already in Stripe (only once). The tables are created automatically.

Don’t connect the test project to the live database or the other way round: test bookings would mix with real ones.

What the database adds:
- **No double bookings on the live site.** While a guest is on the payment page (up to 30 minutes), those nights are held for them. Anyone else trying the same dates at that moment is told they were just taken. Paid nights stay blocked. On the test site dates never block, as before.
- **Bookings show on /admin the moment they’re paid.**
- **A safety net when Stripe’s notification doesn’t arrive.** The guest’s “thank you” page and every visit to `/admin` check Stripe directly. A paid booking is never missed, and the emails go out exactly once.
- **Each email exactly once**, even with double clicks, two admins, or Stripe sending the same notification twice.
- **A history per booking**: started checkout, paid, confirmed by whom, cash received by whom.
- **The calendar on /admin** (see below).

Backups: Neon keeps a restore window (about 6 hours on the free plan, longer on paid plans), and Stripe keeps a copy of every booking on its payment.

## 5. Try it on the test site

1. Open the test address → a house → pick dates → **Continue to checkout** → fill in → pay with `4242 4242 4242 4242`, any future date, any CVC.
2. The deposit is paid right away. Both admin inboxes get **New booking, please confirm**. The guest gets **Deposit received, awaiting confirmation** (dates reserved; full refund if declined).
3. Go to `/admin` → enter your email → open the link → enter the 6-digit code → **Confirm booking & send confirmation**.
4. The guest gets **Booking confirmed** with the PDF; you get a copy. The other 50% is paid **in cash at check-in**: when you receive it, click **Balance received in cash** on `/admin`.
   (**Decline & refund** refunds the deposit in full and tells the guest.)
5. The **Calendar** at the top of `/admin` shows one month for both houses. Bars run from the check-in afternoon to the check-out morning:
   - **navy**: confirmed
   - **sand**: deposit paid, waiting for you
   - **dashed**: a guest is paying right now
   - **grey strip**: nights taken on Airbnb or Booking.com, or blocked by you

   Tap a bar to jump to that booking. Use ‹ › to change month. On a phone it opens at today; swipe sideways for the rest of the month.

When everything works on the test site, repeat steps 3–4 with live keys for the live site.

## 6. Guest reviews (direct stays)

- Every day at about 10:00 (Skopje time) the site emails **“How was your stay?”** to guests whose confirmed stay ended in the last 14 days. This needs `CRON_SECRET` set in Vercel (step 4); Vercel then runs `/api/cron/review-requests` daily (see `vercel.json`).
- The guest opens their personal link (valid 120 days), rates 1–5 stars and writes a review. Both admin inboxes get **New guest review**.
- On `/admin` → **Guest reviews**: **Publish on the website** or **Don’t publish**. Published reviews appear in the house page carousel first, marked **Verified direct stay**.
- To test now: confirm a test booking, then click **Send review request** on it in `/admin`.
- Publish critical reviews too; under EU consumer rules you must not hide genuine negative reviews. Use “Don’t publish” only for abusive, off-topic or personal-data content.
