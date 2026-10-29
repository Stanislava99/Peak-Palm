import { Availability } from "@/components/Availability";
import { Gallery } from "@/components/Gallery";
import { Header } from "@/components/Header";
import { photos, rooms } from "@/lib/photos";
import { getProperty } from "@/lib/properties";
import {
  fetchAirbnbRating,
  fetchBookingListing,
  type AirbnbRating,
  type BookingListing,
  type CalendarDay,
} from "@/lib/listings";
import { calendarWithHolds } from "@/lib/reservations";

export const revalidate = 1800;

const house = getProperty("kaja");
const AIRBNB_URL = house.airbnbUrl;
const BOOKING_URL = house.bookingUrl ?? AIRBNB_URL;

export const metadata = {
  title: "Villa Kaja Bansko · Private chalet by the gondola",
  description:
    "A private holiday chalet in Bansko for up to 15 guests. Five bedrooms, a private sauna, ski storage, and a five-minute walk to the gondola.",
};

const facts = [
  { value: "15", label: "Guests" },
  { value: "5", label: "Bedrooms" },
  { value: "5.5", label: "Bathrooms" },
  { value: "5 min", label: "To the gondola" },
];

const amenities = [
  ["Private sauna", "Pine sauna with a shower and changing space, reserved for your group."],
  ["Five bedrooms", "Four double or triple rooms and one quad apartment, each with a bathroom."],
  ["Kitchen and dining", "Cook together, then sit the whole group at the table."],
  ["Living room", "Sofas, a large TV, and a foosball table for the evenings."],
  ["Ski storage", "A rack by the stone wall so boots and skis stay out of the hallway."],
  ["Parking", "Private parking on the property, on a quiet residential street."],
];

const categories: Array<[keyof AirbnbRating["categories"], string]> = [
  ["cleanliness", "Cleanliness"],
  ["accuracy", "Accuracy"],
  ["checkin", "Check-in"],
  ["communication", "Communication"],
  ["location", "Location"],
  ["value", "Value"],
];

export default async function HomePage() {
  const [rating, bookingResult, calendar] = await Promise.all([
    fetchAirbnbRating(),
    fetchBookingListing(),
    calendarWithHolds().then(
      (days) => ({ days, error: null as string | null }),
      () => ({
        days: [] as CalendarDay[],
        error: "Airbnb’s calendar did not respond. You can still open the listing to check dates.",
      }),
    ),
  ]);
  const booking = bookingResult ?? {
    scoreLabel: "Exceptional",
    reviewCount: 16,
    state: "closed" as const,
    url: BOOKING_URL,
  };

  return (
    <>
      <Header brand="Villa Kaja" />
      <main id="top">
        <section className="hero">
          <img
            src="/photos/01-exterior.jpg"
            alt="Villa Kaja, a white and stone chalet with a balcony, on a cobbled street in Bansko"
          />
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="eyebrow light">Bansko · Sveti Ivan Rilski 18</p>
            <h1>A private chalet, five minutes from the gondola.</h1>
            <p className="lede">
              Villa Kaja is booked as a whole house for families and groups of friends. Walk to the lifts in the
              morning and come back to your own sauna, kitchen, and living room.
            </p>
            <div className="rating-row">
              <a className="rating-pill" href={AIRBNB_URL} target="_blank" rel="noreferrer">
                <span>Airbnb</span>
                <strong>{rating.score.toFixed(2)}</strong>
                <em>{rating.count} reviews</em>
              </a>
              <a className="rating-pill" href={BOOKING_URL} target="_blank" rel="noreferrer">
                <span>Booking.com</span>
                <strong>{booking.scoreLabel}</strong>
                <em>{booking.reviewCount} reviews</em>
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
            <img src="/photos/02-living.jpg" alt="Living and dining room with a red sofa and a long oak table" />
            <img src="/photos/08-bedroom-1.jpg" alt="A bright bedroom with a large bed and turquoise cushions" />
          </div>
        </section>

        <Gallery
          photos={photos}
          rooms={rooms}
          title="The chalet, room by room"
          intro="Photographs are taken from the Villa Kaja Airbnb listing, the same set guests see before they book."
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
            <h2>Rated on both places people already book</h2>
          </div>
          <div className="score-grid">
            <article className="score-card">
              <header>
                <span>Airbnb</span>
                <strong>{rating.score.toFixed(2)}</strong>
              </header>
              <p>{rating.count} reviews · guest favourite</p>
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
              <a href={AIRBNB_URL} target="_blank" rel="noreferrer">
                Read the Airbnb reviews
              </a>
            </article>
            <article className="score-card booking-card">
              <header>
                <span>Booking.com</span>
                <strong>{booking.scoreLabel}</strong>
              </header>
              <p>{booking.reviewCount} reviews on the Villa Kaja Bansko listing.</p>
              <p className="booking-state">{bookingCopy(booking)}</p>
              <a href={BOOKING_URL} target="_blank" rel="noreferrer">
                Open the Booking.com listing
              </a>
            </article>
          </div>
        </section>

        <Availability
          property="kaja"
          maxGuests={house.maxGuests}
          defaultGuests={10}
          kicker="Whole chalet · up to 15 guests"
          finePrint="Check-in after 4:00 pm. Check-out by 11:00 am. The house is reserved for your group only."
          airbnbUrl={AIRBNB_URL}
          bookingUrl={house.bookingUrl}
          intro="Open nights follow the Airbnb calendar, including stays already requested here. Reserve directly, or continue on Airbnb or Booking.com with the same dates."
          initialDays={calendar.days}
          initialError={calendar.error}
          booking={booking}
        />

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
      <footer className="site-footer">
        <div>
          <strong>Villa Kaja</strong>
          <p>18 Sveti Ivan Rilski Street, Bansko, Bulgaria</p>
        </div>
        <div className="footer-links">
          <a href={AIRBNB_URL} target="_blank" rel="noreferrer">
            Airbnb
          </a>
          <a href={BOOKING_URL} target="_blank" rel="noreferrer">
            Booking.com
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
            name: "Villa Kaja",
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

function bookingCopy(booking: BookingListing) {
  if (booking.state === "open") {
    return "The listing is open. Choose dates below and continue on Booking.com to see the price.";
  }
  if (booking.state === "closed") {
    return "The listing page currently redirects as closed, so Booking.com has no nights available. The score above is the one published on that listing. Live dates below come from Airbnb.";
  }
  return "Booking.com did not confirm the listing status on the last check. Use the link to see it directly.";
}
