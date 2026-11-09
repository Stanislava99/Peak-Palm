import { CheckoutForm } from "@/components/CheckoutForm";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icons";
import {
  CANCELLATION_POLICY,
  DEPOSIT_LABEL,
  HOST_REPLY,
  HOUSE_RULES,
  splitPayment,
} from "@/lib/booking-config";
import { brand } from "@/lib/brand";
import { DIRECT_DISCOUNT_LABEL, fetchStayQuote, formatMoney } from "@/lib/pricing";
import { getProperty, isPropertyId, type PropertyId } from "@/lib/properties";
import { calendarWithSources } from "@/lib/reservations";
import { evaluateStay, formatLong } from "@/lib/stay";
import { isTestMode, paymentsEnabled } from "@/lib/stripe";
import type { Metadata } from "next";
import Image from "next/image";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

const HOUSES: Record<PropertyId, { name: string; place: string; href: string; photo: string; alt: string }> = {
  kaja: {
    name: "Villa Kaja",
    place: "Bansko, Bulgaria",
    href: "/villa-kaja",
    photo: "/photos/01-exterior.jpg",
    alt: "The front of Villa Kaja in Bansko",
  },
  janis: {
    name: "Jani’s Beach House",
    place: "Neoi Epivates, Greece",
    href: "/janis",
    photo: "/photos/janis/15-beach.jpg",
    alt: "Balcony at Jani’s Beach House looking over the sea",
  },
};

type Search = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CheckoutPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const requested = one(params.property);
  const property: PropertyId = isPropertyId(requested) ? requested : "kaja";
  const house = HOUSES[property];
  const maxGuests = getProperty(property).maxGuests;
  const checkIn = one(params.checkIn) ?? "";
  const checkOut = one(params.checkOut) ?? "";
  const guests = Math.max(1, Math.min(maxGuests, Number(one(params.guests)) || 1));
  const backToDates = `${house.href}#stay`;

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && checkOut > checkIn;
  const [calendar, priced] = valid
    ? await Promise.all([
        calendarWithSources(property).catch(() => null),
        fetchStayQuote(property, checkIn, checkOut, guests),
      ])
    : [null, null];
  const verdict = calendar ? evaluateStay(calendar.days, checkIn, checkOut) : null;
  const quote = priced?.ok ? priced.quote : null;
  const split = quote ? splitPayment(quote.directTotal) : null;

  let problem: string | null = null;
  if (!valid) problem = "Choose your dates first.";
  else if (verdict && !verdict.ok) problem = `Those dates can’t be booked: ${verdict.message}`;
  else if (!quote) problem = "We couldn’t load today’s price for these dates. Please try again in a minute.";

  return (
    <div className="checkout-page">
      <Header sections={false} house={house.name} />
      <main className="checkout" id="top">
        <ol className="checkout-steps" aria-label="Booking steps">
          <li className="is-done">
            <span>
              <Icon name="check" size={16} />
            </span>
            Dates &amp; guests
          </li>
          <li className="is-current">
            <span>2</span>
            Your details
          </li>
          <li>
            <span>3</span>
            {paymentsEnabled(property) ? "Secure payment" : "Payment after confirmation"}
          </li>
        </ol>

        <div className="checkout-head">
          <a className="checkout-back" href={backToDates}>
            <Icon name="arrow" size={16} className="flip" /> Change dates
          </a>
          <h1>Book {house.name}</h1>
          <p>
            You’re booking direct with the host, {DIRECT_DISCOUNT_LABEL} below the Airbnb price.
          </p>
        </div>

        {problem ? (
          <div className="checkout-problem">
            <p>{problem}</p>
            <a className="button primary" href={backToDates}>
              Back to the calendar
            </a>
          </div>
        ) : (
          <div className="checkout-layout">
            <section className="checkout-main" aria-label="Your details">
              <CheckoutForm
                property={property}
                checkIn={checkIn}
                checkOut={checkOut}
                guests={guests}
                deposit={split!.deposit}
                paymentsOn={paymentsEnabled(property)}
                houseName={house.name}
              />
              <div className="checkout-policies">
                <div>
                  <h3>Cancellation</h3>
                  <ul>
                    {CANCELLATION_POLICY.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>House rules</h3>
                  <ul>
                    {HOUSE_RULES[property].map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <aside className="checkout-summary" aria-label="Your stay">
              <div className="summary-house">
                <span className="summary-photo">
                  <Image src={house.photo} alt={house.alt} fill sizes="120px" />
                </span>
                <div>
                  <p className="eyebrow">{brand.short}</p>
                  <h2>{house.name}</h2>
                  <p>{house.place}</p>
                </div>
              </div>
              <dl className="summary-stay">
                <div>
                  <dt>Check-in</dt>
                  <dd>{formatLong(checkIn)}</dd>
                </div>
                <div>
                  <dt>Check-out</dt>
                  <dd>{formatLong(checkOut)}</dd>
                </div>
                <div>
                  <dt>Guests</dt>
                  <dd>{guests}</dd>
                </div>
                <div>
                  <dt>Nights</dt>
                  <dd>{quote!.nights}</dd>
                </div>
              </dl>
              <div className="summary-price">
                <div className="price-row airbnb">
                  <span>Same dates on Airbnb</span>
                  <s>{formatMoney(quote!.airbnbTotal)}</s>
                </div>
                <div className="price-row direct">
                  <span>
                    Your direct price
                    <small>about {formatMoney(quote!.perNight)} a night, fees included</small>
                  </span>
                  <strong>{formatMoney(quote!.directTotal)}</strong>
                </div>
                <p className="price-save">
                  You save <b>{formatMoney(quote!.savings)}</b> by booking direct.
                </p>
              </div>
              <ol className="summary-schedule">
                <li>
                  <b>
                    {paymentsEnabled(property) ? "Today" : "After the host confirms"} · {formatMoney(split!.deposit)}
                  </b>
                  <span>
                    {paymentsEnabled(property)
                      ? `${DEPOSIT_LABEL} deposit, paid now by card. ${brand.host} confirms your booking ${HOST_REPLY} and emails your confirmation. If the dates can’t be confirmed, you get a full refund.`
                      : `${DEPOSIT_LABEL} deposit, paid through the secure payment link ${brand.host} emails you, ${HOST_REPLY}.`}
                  </span>
                </li>
                <li>
                  <b>At check-in · {formatMoney(split!.balance)}</b>
                  <span>The other {DEPOSIT_LABEL}, paid in cash (euros) when you arrive.</span>
                </li>
              </ol>
              <p className="summary-secure">
                <Icon name="key" size={16} /> Secure payment by Stripe. Card details never touch this site.
                {isTestMode() ? " (Test mode: use card 4242 4242 4242 4242.)" : ""}
              </p>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
