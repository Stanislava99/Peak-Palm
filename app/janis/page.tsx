import { Availability } from "@/components/Availability";
import { Enquiry } from "@/components/Enquiry";
import { Gallery } from "@/components/Gallery";
import { GuestScore, Stars } from "@/components/GuestScore";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Icon, type IconName } from "@/components/Icons";
import { janisPhotos, janisRooms } from "@/lib/janis-photos";
import { fetchAirbnbRating, type AirbnbRating, type CalendarDay } from "@/lib/listings";
import { getProperty } from "@/lib/properties";
import { calendarWithSources, type CalendarSources } from "@/lib/reservations";
import { DIRECT_DISCOUNT_LABEL } from "@/lib/pricing";
import { paymentsEnabled } from "@/lib/stripe";
import { getSiteUrl } from "@/lib/site";
import Image from "next/image";
import type { Metadata } from "next";

export const revalidate = 1800;

const house = getProperty("janis");

const description =
  "Holiday house in Neoi Epivates, Greece, near Thessaloniki, for up to 9 guests. Three bedrooms, sea-view balconies, and a Blue Flag beach about 30 metres away.";

export const metadata: Metadata = {
  title: "Jani’s Beach House — beach house near Thessaloniki",
  description,
  alternates: { canonical: "/janis" },
  openGraph: {
    title: "Jani’s Beach House — beach house near Thessaloniki",
    description,
    url: "/janis",
    images: [
      {
        url: "/photos/janis/01-cover.jpg",
        alt: "The path from Jani’s Beach House down to the sea",
      },
    ],
  },
};

const facts = [
  { value: "9", label: "Guests" },
  { value: "3", label: "Bedrooms" },
  { value: "4", label: "Bathrooms" },
  { value: "30 m", label: "To the beach" },
];

const amenities: Array<[IconName, string, string]> = [
  ["sea", "The beach", "A Blue Flag sandy beach about 30 metres from the door, with the gulf in front of the house."],
  ["umbrella", "Sea-view terraces", "Balconies look over the water toward Thessaloniki. Sunbeds and umbrellas are included."],
  ["bed", "Three bedrooms", "All enclosed. One is a duplex, with beds on two levels and its own stairs."],
  ["kitchen", "Kitchen and dining", "The half-basement holds the kitchen, dining table, and living space, and opens to the yard."],
  ["leaf", "Backyard", "A private seating courtyard for coffee and long evenings. Barbecues are not allowed."],
  ["key", "Self check-in", "A lockbox on the door, so the group can arrive without waiting for a handover."],
];

const categories: Array<[keyof AirbnbRating["categories"], string]> = [
  ["cleanliness", "Cleanliness"],
  ["accuracy", "Accuracy"],
  ["checkin", "Check-in"],
  ["communication", "Communication"],
  ["location", "Location"],
  ["value", "Value"],
];

export default async function JanisPage() {
  const [rating, calendar] = await Promise.all([
    fetchAirbnbRating("janis"),
    calendarWithSources("janis").then(
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
      <Header house="Jani’s Beach House" sibling={{ href: "/villa-kaja", label: "The Peak · Bansko" }} />
      <main id="top">
        <section className="hero">
          <Image src="/photos/janis/01-cover.jpg" alt="The path from Jani’s Beach House down to the sea, the cover photo from the Airbnb listing" fill priority sizes="100vw" />
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="eyebrow light">The Palm · Neoi Epivates · Thermaikos</p>
            <h1 className="hero-title">Jani’s Beach House</h1>
            <p className="hero-sub">A beach house, a short walk from the sand.</p>
            <p className="lede">
              Jani’s Beach House is booked as a whole house for families and friends. The gulf is in front of the
              balconies, and Thessaloniki is a short drive when you want the city.
            </p>
            <div className="rating-row">
              <a className="rating-pill" href={house.airbnbUrl} target="_blank" rel="noreferrer">
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
            <h2>Mornings on the balcony, evenings in the yard.</h2>
            <p>
              The maisonette sits in a small row of houses between Neoi Epivates and Agia Triada, on a Blue Flag
              beach. Guests have the place to themselves: three bedrooms upstairs, and the kitchen, dining, and living
              room below, opening onto the backyard.
            </p>
            <p>
              Host Frosina looks after this house and Villa Kaja in Bansko.
              {rating.live
                ? " The Airbnb score on this page is read from the live listing."
                : " The Airbnb score shown here was last confirmed at 4.93 from 43 reviews."}
            </p>
            <ul className="house-points">
              <li>Exclusive use for one group</li>
              <li>Sea view from the terraces</li>
              <li>Taverns, cafés, and the beach within a short walk</li>
            </ul>
          </div>
          <div className="house-photos">
            <span className="house-photo"><Image src="/photos/janis/15-beach.jpg" alt="Balcony table looking over the sea" fill sizes="(max-width: 900px) 100vw, 28vw" /></span>
            <span className="house-photo"><Image src="/photos/janis/02-cover.jpg" alt="Living room opening toward the kitchen and dining table" fill sizes="(max-width: 900px) 100vw, 28vw" /></span>
          </div>
        </section>

        <Gallery
          photos={janisPhotos}
          rooms={janisRooms}
          title="The house, from the beach inward"
          intro="From the path down to the sand, through the balconies, and into the rooms."
        />

        <GuestScore
          score={rating.score}
          live={rating.live}
          count={rating.count}
          airbnbUrl={house.airbnbUrl}
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
          property="janis"
          maxGuests={house.maxGuests}
          defaultGuests={6}
          kicker="The whole house · up to 9 guests"
          finePrint="Self check-in with a lockbox. Quiet hours are 11:00 pm to 8:00 am. The house is reserved for your group only."
          airbnbUrl={house.airbnbUrl}
          intro={`Pick your dates and guests to see your direct price, ${DIRECT_DISCOUNT_LABEL} below Airbnb. At checkout you pay a 50% deposit; the host then confirms your booking by email.`}
          initialDays={calendar.days}
          initialError={calendar.error}
          initialSources={calendar.sources}
          paymentsOn={paymentsEnabled()}
        />

        <Enquiry property="janis" house="Jani’s Beach House" />

        <section id="location" className="section location">
          <div>
            <p className="eyebrow">Location</p>
            <h2>Neoi Epivates, on the Thermaic Gulf</h2>
            <p>
              The house stands between Neoi Epivates and Agia Triada, in the municipality of Thermaikos. The beach in
              front is public, so you can use it for as long as you like. Buses run into Thessaloniki, and the airport
              is a short drive.
            </p>
            <ul className="nearby">
              <li>Blue Flag beach · about 30 metres</li>
              <li>Restaurants and shops in the village · a short walk</li>
              <li>Thessaloniki Airport · about 9 km</li>
              <li>Thessaloniki centre · about 20 km</li>
            </ul>
            <a
              className="text-link"
              href="https://www.google.com/maps/search/?api=1&query=Jani%27s+Beach+House+Neoi+Epivates"
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          </div>
          <iframe
            title="Map of Jani’s Beach House in Neoi Epivates"
            src="https://www.openstreetmap.org/export/embed.html?bbox=22.880%2C40.494%2C22.910%2C40.510&layer=mapnik&marker=40.502%2C22.8943"
          />
        </section>
      </main>
      <Footer address="Jani’s Beach House, Neoi Epivates, Thermaikos" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VacationRental",
            name: "Jani’s Beach House",
            url: `${getSiteUrl()}/janis`,
            image: `${getSiteUrl()}/photos/janis/01-cover.jpg`,
            sameAs: house.airbnbUrl,
            description:
              "Beachfront house in Neoi Epivates for up to 9 guests, with three bedrooms, four bathrooms, and the sand about 30 metres away.",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Neoi Epivates",
              addressRegion: "Thermaikos",
              addressCountry: "GR",
            },
            geo: { "@type": "GeoCoordinates", latitude: 40.502, longitude: 22.8943 },
            numberOfRooms: 3,
            occupancy: { "@type": "QuantitativeValue", maxValue: 9 },
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
