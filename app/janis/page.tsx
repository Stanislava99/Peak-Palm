import { Availability } from "@/components/Availability";
import { Gallery } from "@/components/Gallery";
import { Header } from "@/components/Header";
import { janisPhotos, janisRooms } from "@/lib/janis-photos";
import { fetchAirbnbRating, type AirbnbRating, type CalendarDay } from "@/lib/listings";
import { getProperty } from "@/lib/properties";
import { calendarWithHolds } from "@/lib/reservations";
import type { Metadata } from "next";

export const revalidate = 1800;

const house = getProperty("janis");

export const metadata: Metadata = {
  title: "Jani’s Beach House · Neoi Epivates",
  description:
    "A beachfront house in Neoi Epivates for up to 9 guests. Three bedrooms, four bathrooms, sea-view balconies, and the sand about 30 metres away.",
};

const facts = [
  { value: "9", label: "Guests" },
  { value: "3", label: "Bedrooms" },
  { value: "4", label: "Bathrooms" },
  { value: "30 m", label: "To the beach" },
];

const amenities = [
  ["The beach", "A Blue Flag sandy beach about 30 metres from the door, with the gulf in front of the house."],
  ["Sea-view terraces", "Balconies look over the water toward Thessaloniki. Sunbeds and umbrellas are included."],
  ["Three bedrooms", "All enclosed. One is a duplex, with beds on two levels and its own stairs."],
  ["Kitchen and dining", "The half-basement holds the kitchen, dining table, and living space, and opens to the yard."],
  ["Backyard", "A private seating courtyard for coffee and long evenings. Barbecues are not allowed."],
  ["Self check-in", "A lockbox on the door, so the group can arrive without waiting for a handover."],
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
    calendarWithHolds("janis").then(
      (days) => ({ days, error: null as string | null }),
      () => ({
        days: [] as CalendarDay[],
        error: "Airbnb’s calendar did not respond. You can still open the listing to check dates.",
      }),
    ),
  ]);

  return (
    <>
      <Header brand="Jani’s Beach House" />
      <main id="top">
        <section className="hero">
          <img
            src="/photos/janis/01-cover.jpg"
            alt="The path from Jani’s Beach House down to the sea, the cover photo from the Airbnb listing"
          />
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="eyebrow light">Neoi Epivates · Thermaikos</p>
            <h1>A beach house, a short walk from the sand.</h1>
            <p className="lede">
              Jani’s Beach House is booked as a whole house for families and friends. The gulf is in front of the
              balconies, and Thessaloniki is a short drive when you want the city.
            </p>
            <div className="rating-row">
              <a className="rating-pill" href={house.airbnbUrl} target="_blank" rel="noreferrer">
                <span>Airbnb</span>
                <strong>{rating.score.toFixed(2)}</strong>
                <em>{rating.count} reviews</em>
              </a>
            </div>
            <a className="hero-cta" href="#stay">
              Check availability
            </a>
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
            <img src="/photos/janis/15-beach.jpg" alt="Balcony table looking over the sea" />
            <img src="/photos/janis/02-cover.jpg" alt="Living room opening toward the kitchen and dining table" />
          </div>
        </section>

        <Gallery
          photos={janisPhotos}
          rooms={janisRooms}
          title="The house, from the beach inward"
          intro="Photographs are taken from the Jani’s Beach House Airbnb listing, the same set guests see before they book."
        />

        <section className="section amenities">
          <div className="section-head">
            <p className="eyebrow">In the house</p>
            <h2>What you have to yourselves</h2>
          </div>
          <div className="amenity-grid">
            {amenities.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section scores">
          <div className="section-head">
            <p className="eyebrow">Guest scores</p>
            <h2>Rated by people who have stayed</h2>
          </div>
          <div className="score-grid">
            <article className="score-card">
              <header>
                <span>Airbnb</span>
                <strong>{rating.score.toFixed(2)}</strong>
              </header>
              <p>{rating.count} reviews</p>
              <ul>
                {categories.map(([key, label]) => (
                  <li key={key}>
                    <span>{label}</span>
                    <span className="bar" style={{ ["--score" as string]: rating.categories[key] }}>
                      <i />
                    </span>
                    <em>{rating.categories[key].toFixed(2)}</em>
                  </li>
                ))}
              </ul>
              <a href={house.airbnbUrl} target="_blank" rel="noreferrer">
                Read the Airbnb reviews
              </a>
            </article>
            <article className="score-card">
              <header>
                <span>Around you</span>
                <strong>30 m</strong>
              </header>
              <p>From the door to a Blue Flag beach on the Thermaic Gulf.</p>
              <ul className="nearby">
                <li>Gorgona tavern · about 50 metres</li>
                <li>Thessaloniki centre · about 20 km</li>
                <li>Thessaloniki Airport · about 9 km</li>
                <li>Quiet hours · 11:00 pm to 8:00 am</li>
              </ul>
            </article>
          </div>
        </section>

        <Availability
          property="janis"
          maxGuests={house.maxGuests}
          defaultGuests={6}
          kicker="The whole house · up to 9 guests"
          finePrint="Self check-in with a lockbox. Quiet hours are 11:00 pm to 8:00 am. The house is reserved for your group only."
          airbnbUrl={house.airbnbUrl}
          bookingUrl={null}
          intro="Open nights follow the Airbnb calendar, including stays already requested here. Reserve directly, or continue on Airbnb with the same dates."
          initialDays={calendar.days}
          initialError={calendar.error}
          booking={null}
        />

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
      <footer className="site-footer">
        <div>
          <strong>Jani’s Beach House</strong>
          <p>Neoi Epivates, Thermaikos, Greece</p>
        </div>
        <div className="footer-links">
          <a href={house.airbnbUrl} target="_blank" rel="noreferrer">
            Airbnb
          </a>
          <a href="#stay">Availability</a>
          <a href="/">Both houses</a>
        </div>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VacationRental",
            name: "Jani’s Beach House",
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
