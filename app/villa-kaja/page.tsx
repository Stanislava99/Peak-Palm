import { Availability } from "@/components/Availability";
import { MeetHosts } from "@/components/MeetHosts";
import { Gallery } from "@/components/Gallery";
import { GuestScore, Stars } from "@/components/GuestScore";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Icon, type IconName } from "@/components/Icons";
import { photos, rooms } from "@/lib/photos";
import { getProperty } from "@/lib/properties";
import { fetchAirbnbReviews } from "@/lib/reviews";
import { publishedDirectReviews } from "@/lib/guest-reviews";
import { fetchAirbnbRating, type AirbnbRating, type CalendarDay } from "@/lib/listings";
import { calendarWithSources, type CalendarSources } from "@/lib/reservations";
import { DIRECT_DISCOUNT_LABEL } from "@/lib/pricing";
import { paymentsEnabled } from "@/lib/stripe";
import { getSiteUrl } from "@/lib/site";
import Image from "next/image";

export const revalidate = 1800;

const house = getProperty("kaja");
const AIRBNB_URL = house.airbnbUrl;

const description =
  "Private holiday house in Bansko, Bulgaria, for up to 15 guests. Five bedrooms, a private sauna, ski storage, parking, and about a five-minute walk to the gondola.";

export const metadata = {
  title: "Villa Kaja Bansko — holiday house near the gondola",
  description,
  alternates: { canonical: "/villa-kaja" },
  openGraph: {
    title: "Villa Kaja Bansko — holiday house near the gondola",
    description,
    url: "/villa-kaja",
    images: [{ url: "/photos/01-exterior.jpg", alt: "The front of Villa Kaja in Bansko" }],
  },
};

const facts = [
  { value: "15", label: "Guests" },
  { value: "5", label: "Bedrooms" },
  { value: "5.5", label: "Bathrooms" },
  { value: "5 min", label: "To the gondola" },
];

const amenities: Array<[IconName, string, string]> = [
  ["sauna", "Private sauna", "Pine sauna with a shower and changing space, reserved for your group."],
  ["bed", "Five bedrooms", "Four double or triple rooms and one quad apartment, each with a bathroom."],
  ["kitchen", "Kitchen and dining", "Cook together, then sit the whole group at the table."],
  ["sofa", "Living room", "Sofas, a large TV, and a foosball table for the evenings."],
  ["ski", "Ski storage", "A rack by the stone wall so boots and skis stay out of the hallway."],
  ["parking", "Parking", "Private parking on the property, on a quiet residential street."],
];

const categories: Array<[keyof AirbnbRating["categories"], string]> = [
  ["cleanliness", "Cleanliness"],
  ["accuracy", "Accuracy"],
  ["checkin", "Check-in"],
  ["communication", "Communication"],
  ["location", "Location"],
  ["value", "Value"],
];

export default async function VillaKajaPage() {
  const [rating, reviews, calendar] = await Promise.all([
    fetchAirbnbRating(),
    Promise.all([publishedDirectReviews("kaja"), fetchAirbnbReviews("kaja")]).then(([direct, airbnb]) => [...direct, ...airbnb]),
    calendarWithSources().then(
      ({ days, sources }) => ({ days, sources, error: null as string | null }),
      () => ({
        days: [] as CalendarDay[],
        sources: { booking: "not-configured" } as CalendarSources,
        error: "Airbnb’s calendar did not respond. You can still open the listing to check dates.",
      }),
    ),
  ]);
  return (
    <>
      <Header house="Villa Kaja" sibling={{ href: "/janis", label: "Sea · Greece" }} />
      <main id="top">
        <section className="hero">
          <Image src="/photos/01-exterior.jpg" alt="Villa Kaja, a white and stone chalet with a balcony, on a cobbled street in Bansko" fill priority sizes="100vw" />
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="eyebrow light">Ski · Bansko · Sveti Ivan Rilski 18</p>
            <h1 className="hero-title">Villa Kaja</h1>
            <p className="hero-sub">A private chalet, five minutes from the gondola.</p>
            <p className="lede">
              Villa Kaja is booked as a whole house for families and groups of friends. Walk to the lifts in the
              morning and come back to your own sauna, kitchen, and living room.
            </p>
            <div className="rating-row">
              <a className="rating-pill" href={AIRBNB_URL} target="_blank" rel="noreferrer">
                <Stars score={rating.score} size={15} />
                <strong>{rating.score.toFixed(2)}</strong>
                <em>{rating.count} reviews on Airbnb</em>
              </a>
            </div>
            <div className="hero-actions">
              <a className="hero-cta" href="#stay">
                Book direct and save {DIRECT_DISCOUNT_LABEL}
              </a>
              <span className="hero-note">{DIRECT_DISCOUNT_LABEL} below the Airbnb price for the same dates</span>
            </div>
          </div>
        </section>

        <section className="fact-bar" aria-label="At a glance">
          {facts.map((fact) => (
            <div key={fact.label}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </div>
          ))}
        </section>

        <section id="house" className="section house">
          <div className="house-copy">
            <p className="eyebrow">The house</p>
            <h2>Built for a ski week with the people you actually want around.</h2>
            <p>
              The chalet sits on a quiet, family street in the ski-lift district. Guests have the place to themselves:
              bedrooms, the open living and dining room, the kitchen, ski storage, and the sauna.
            </p>
            <p>
              Host Frosina is a Superhost.
              {rating.live
                ? " The Airbnb score on this page is read from the live listing."
                : " The Airbnb score shown here was last confirmed at 4.94 from 114 reviews."}
            </p>
            <ul className="house-points">
              <li>Exclusive use for one group</li>
              <li>Mountain light in the bedrooms</li>
              <li>Restaurants and the gondola within a short walk</li>
            </ul>
          </div>
          <div className="house-photos">
            <span className="house-photo"><Image src="/photos/02-living.jpg" alt="Living and dining room with a red sofa and a long oak table" fill sizes="(max-width: 900px) 100vw, 28vw" /></span>
            <span className="house-photo"><Image src="/photos/08-bedroom-1.jpg" alt="A bright bedroom with a large bed and turquoise cushions" fill sizes="(max-width: 900px) 100vw, 28vw" /></span>
          </div>
        </section>

        <Gallery
          photos={photos}
          rooms={rooms}
          title="The chalet, room by room"
          intro="Move through the house the way a guest does, from the street to the sauna."
        />

        <GuestScore
          score={rating.score}
          live={rating.live}
          reviews={reviews}
          superhost
          count={rating.count}
          airbnbUrl={AIRBNB_URL}
          categories={categories.map(([key, label]) => ({ label, score: rating.categories[key] }))}
        />

        <section className="section amenities">
          <div className="section-head">
            <p className="eyebrow">In the house</p>
            <h2>What you have to yourselves</h2>
          </div>
          <div className="amenity-grid">
            {amenities.map(([icon, title, text]) => (
              <article key={title}>
                <span className="amenity-icon"><Icon name={icon} size={26} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <Availability
          property="kaja"
          maxGuests={house.maxGuests}
          defaultGuests={10}
          kicker="Whole chalet · up to 15 guests"
          finePrint="Check-in after 4:00 pm. Check-out by 11:00 am. The house is reserved for your group only."
          airbnbUrl={AIRBNB_URL}
          intro={`Pick your dates and guests to see your direct price, ${DIRECT_DISCOUNT_LABEL} below Airbnb. At checkout you pay a 50% deposit (the rest in cash at check-in); the host then confirms your booking by email.`}
          initialDays={calendar.days}
          initialError={calendar.error}
          initialSources={calendar.sources}
          paymentsOn={paymentsEnabled("kaja")}
        />

        <MeetHosts property="kaja" house="Villa Kaja" reviewCount={rating.count} communication={rating.categories.communication} />

        <section id="location" className="section location">
          <div>
            <p className="eyebrow">Location</p>
            <h2>18 Sveti Ivan Rilski Street, Bansko</h2>
            <p>
              About a five-minute walk to the gondola, with the ski area, restaurants, and the rest of town close
              enough to skip a taxi. Sofia airport is roughly a two-and-a-half-hour drive.
            </p>
            <ul className="nearby">
              <li>Gondola lift · about 5 minutes on foot</li>
              <li>Bansko ski area · a short walk</li>
              <li>Town restaurants and bars · nearby</li>
              <li>Quiet hours overnight on a residential street</li>
            </ul>
            <a
              className="text-link"
              href="https://www.google.com/maps/search/?api=1&query=18+Sveti+Ivan+Rilski+Street+Bansko"
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          </div>
          <iframe
            title="Map of Villa Kaja in Bansko"
            src="https://www.openstreetmap.org/export/embed.html?bbox=23.470%2C41.823%2C23.492%2C41.835&layer=mapnik&marker=41.8289%2C23.4803"
          />
        </section>
      </main>
      <Footer address="Villa Kaja, 18 Sveti Ivan Rilski Street, Bansko" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VacationRental",
            name: "Villa Kaja",
            url: `${getSiteUrl()}/villa-kaja`,
            image: `${getSiteUrl()}/photos/01-exterior.jpg`,
            sameAs: AIRBNB_URL,
            description:
              "Private holiday chalet in Bansko for up to 15 guests, with five bedrooms, a private sauna, and gondola access on foot.",
            address: {
              "@type": "PostalAddress",
              streetAddress: "18 Sveti Ivan Rilski Street",
              addressLocality: "Bansko",
              addressCountry: "BG",
            },
            geo: { "@type": "GeoCoordinates", latitude: 41.8289, longitude: 23.4803 },
            numberOfRooms: 5,
            occupancy: { "@type": "QuantitativeValue", maxValue: 15 },
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: rating.score,
              reviewCount: rating.count,
              bestRating: 5,
            },
          }),
        }}
      />
    </>
  );
}

