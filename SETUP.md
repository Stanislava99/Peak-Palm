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

## Visitor analytics (Umami Cloud)

- Dashboard: https://cloud.umami.is.
- **Test and live share one Umami website** (`5640458b-…`: the default in `lib/analytics.ts`, and the live project's `UMAMI_WEBSITE_ID`), because the Umami plan's website limit is reached. Keep them apart with the **Hostname** filter: `seaandskivillas.com` = real guests, `peak-and-palm-test.vercel.app` = tests. To separate fully, free a website slot in Umami, create one for the test address and set its ID as `UMAMI_WEBSITE_ID` on `sea-and-ski-test`.
- Never on Vercel previews or localhost. Turn it off anywhere with `ANALYTICS=off`.
- Script and data go through `/stats/…` on this site (rewrites in `next.config.ts`), so the CSP stays `'self'`. Admin, review and unsubscribe pages are never tracked. Query strings are stripped, so Stripe session IDs never reach Umami. No names, emails, phones or booking refs are sent.
- Events (`lib/track.ts`): Calendar viewed, Calendar used, Dates selected, Price shown / Price failed, Continue to checkout, Checkout started, Pay deposit clicked, Checkout error, Booking request sent, Booking paid (with revenue), Question sent, Choose dates click, Airbnb click, Booking.com click, WhatsApp/Phone/Email/Social click. Most carry `house` (kaja/janis) and link clicks carry `place` (section of the page).
- Before Nov 2026 no custom event reached Umami (the tracker's `<script id="umami">` hid `window.umami.track`); only page views. Events count from the fix onwards.

### Booking funnel ("Booking 1…6" events, `lib/funnel.ts`)

One event per step, numbered so they sort in order. **Every** one carries: `house` (kaja = Villa Kaja, janis = Jani's Beach House), `month` (check-in month), `nights`, `guests`, `lead` (how far ahead: 0-7d / 8-30d / 31-90d / 90d+), `stay` (e.g. `2027-02 · 7n · 6g`) and, once the price is known, `price` (band, e.g. €1000-1999).

| Event | When | Extra detail |
|---|---|---|
| Booking 1: dates picked | valid dates + guests chosen on a house page (each new choice) | |
| Booking 2: checkout clicked | "Continue to checkout" | `place` (card / mobile-bar) |
| Booking 2: checkout problem | checkout opened but can't continue | `reason`: no dates / dates not available / price not loaded |
| Booking 3: form filled | name, email, phone valid + rules ticked | `seconds` it took |
| Booking 3: form left | checkout closed/left without sending | `lastField` (name/email/phone/arrival/message/rules/offers/none), `fieldsDone` (0-4), `seconds` |
| Booking 4: form submitted | Pay deposit / Request to book | `offers` (opted in), `message` (wrote one), `arrivalSet` (yes/no only) |
| Booking 4: payment page error | Stripe page couldn't be opened | `reason` (dates just taken, price or bookings unavailable, details rejected, stripe error…), `status` |
| Booking 5: payment started | guest sent to Stripe | `deposit` (€), `attempt` (1st, 2nd… try for this stay) |
| Booking 5: request sent | only while online payment is off | |
| Booking 6: payment succeeded | thank-you page after paying (once per booking) | `revenue` + `currency` (Umami Revenue report), `deposit`, `attempt`, `onStripe` (time on Stripe's page) |
| Booking 6: payment failed | Stripe declined a payment (each failed attempt once; sent by the server) | `reason` (Stripe code: card_declined, insufficient_funds, expired_card, authentication_required…), `brand` (visa, mastercard…), `secure3d` (failed the bank check) |
| Booking 6: payment cancelled | guest pressed back on Stripe's page | `attempt`, `onStripe` |

Nothing personal is sent: no names, emails, phones, exact dates, booking refs or what people typed (only which field they were on). "Payment failed" comes from Stripe's server, so its country/device are meaningless and it isn't in the visitor's path; read only its count and properties. Guests who close the tab on Stripe's page show as "payment started" without an outcome.

**Read it in Umami** (always add the filter Hostname = `seaandskivillas.com` for real guests):
- **Where people drop off:** Reports → Funnel, steps of type Event: Booking 1: dates picked → Booking 2: checkout clicked → Booking 3: form filled → Booking 4: form submitted → Booking 5: payment started → Booking 6: payment succeeded. Window 60 min. Covers both houses.
- **Which house / dates / prices:** Events → pick an event → **Properties** → `house`, `month`, `nights`, `guests`, `lead`, `price`. Per-house drop-off: read `house` on each step in turn.
- **Why payments fail or stall:** Events → Booking 6: payment failed → `reason`, `brand`; Booking 6: payment cancelled → `onStripe`, `attempt`; Booking 4: payment page error → `reason`.
- **Where in the form people quit:** Events → Booking 3: form left → `lastField`, `fieldsDone`.
- **Revenue:** Reports → Revenue, event Booking 6: payment succeeded (stay totals in EUR).
- Vercel Analytics also receives the funnel, but Vercel only records custom events on a Pro team.
