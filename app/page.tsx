import { CardSlider } from "@/components/Carousel";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { HouseGate } from "@/components/HouseGate";
import { Icon, type IconName } from "@/components/Icons";
import { Mark } from "@/components/Logo";
import { brand } from "@/lib/brand";
import { fetchAirbnbRating } from "@/lib/listings";
import { properties } from "@/lib/properties";
import { DIRECT_DISCOUNT_LABEL } from "@/lib/pricing";
import { getSiteUrl } from "@/lib/site";
import type { Metadata } from "next";

export const revalidate = 3600;

const description =
  "Holiday houses in Bansko, Bulgaria and Neoi Epivates, Greece. Villa Kaja sleeps 15 near the gondola. Jani’s Beach House sleeps 9, about 30 metres from the beach.";

export const metadata: Metadata = {
  title: { absolute: `${brand.name} · Holiday houses in Bansko and Greece` },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${brand.name} · ${brand.tagline}`,
    description,
    url: "/",
    images: [{ url: "/brand/og.jpg", width: 1200, height: 630, alt: `${brand.name}: ${brand.tagline}` }],
  },
};

type House = {
  side: string;
  season: string;
  name: string;
  href: string;
  place: string;
  photos: Array<{ src: string; alt: string }>;
  summary: string;
  facts: Array<[string, string]>;
  highlights: Array<[IconName, string]>;
};

const houses: House[] = [
  {
    side: "The Peak",
    season: "Winter in the mountains",
    name: "Villa Kaja",
    href: "/villa-kaja",
    place: "Bansko, Bulgaria",
    photos: [
      { src: "/photos/01-exterior.jpg", alt: "The white and stone front of Villa Kaja in Bansko" },
      { src: "/photos/02-living.jpg", alt: "Living and dining room with a red sofa and a long oak table" },
      { src: "/photos/15-sauna.jpg", alt: "Private pine sauna opening onto a shower" },
      { src: "/photos/08-bedroom-1.jpg", alt: "Bedroom with a large bed and turquoise cushions" },
      { src: "/photos/16-ski.jpg", alt: "Wooden ski rack against a stone wall" },
    ],
    summary:
      "A private holiday house for up to 15 guests, with five bedrooms, a private sauna, ski storage, and parking, about a five-minute walk from the gondola.",
    facts: [
      ["15", "Guests"],
      ["5", "Bedrooms"],
      ["5 min", "To the gondola"],
    ],
    highlights: [
      ["sauna", "Private sauna"],
      ["ski", "Ski storage"],
      ["parking", "Parking"],
    ],
  },
  {
    side: "The Palm",
    season: "Summer by the sea",
    name: "Jani’s Beach House",
    href: "/janis",
    place: "Neoi Epivates, Greece",
    photos: [
      { src: "/photos/janis/15-beach.jpg", alt: "Balcony table looking over a blue railing to the sea" },
      { src: "/photos/janis/01-cover.jpg", alt: "Palm trees and a path leading from the house to the beach" },
      { src: "/photos/janis/02-cover.jpg", alt: "Open living room with the kitchen and dining table beyond" },
      { src: "/photos/janis/11-bedroom-202.jpg", alt: "Upper bedroom with its own bathroom" },
      { src: "/photos/janis/17-sunset.jpg", alt: "Sunset over the gulf, seen from the sand" },
    ],
    summary:
      "A holiday house near Thessaloniki for up to 9 guests, with three bedrooms, sea-view balconies, and a Blue Flag beach about 30 metres away.",
    facts: [
      ["9", "Guests"],
      ["3", "Bedrooms"],
      ["30 m", "To the beach"],
    ],
    highlights: [
      ["sea", "Blue Flag beach"],
      ["terrace", "Sea-view balconies"],
      ["key", "Self check-in"],
    ],
  },
];

const motifs: Array<[IconName, string]> = [
  ["mountain", "Mountains"],
  ["sea", "Sea"],
  ["palm", "Palm"],
  ["ski", "Ski"],
  ["sun", "Sun"],
  ["leaf", "Escape"],
];

export default async function HomePage() {
  const site = getSiteUrl();
  const [kaja, janis] = await Promise.all([fetchAirbnbRating("kaja"), fetchAirbnbRating("janis")]);
  const ratings = [kaja, janis];

  const graph = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: brand.name,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        url: `${site}/villa-kaja`,
        item: {
          "@type": "VacationRental",
          name: "Villa Kaja",
          url: `${site}/villa-kaja`,
          image: `${site}/photos/01-exterior.jpg`,
          address: {
            "@type": "PostalAddress",
            streetAddress: "18 Sveti Ivan Rilski Street",
            addressLocality: "Bansko",
            addressCountry: "BG",
          },
          sameAs: properties.kaja.airbnbUrl,
        },
      },
      {
        "@type": "ListItem",
        position: 2,
        url: `${site}/janis`,
        item: {
          "@type": "VacationRental",
          name: "Jani’s Beach House",
          url: `${site}/janis`,
          image: `${site}/photos/janis/01-cover.jpg`,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Neoi Epivates",
            addressRegion: "Thermaikos",
            addressCountry: "GR",
          },
          sameAs: properties.janis.airbnbUrl,
        },
      },
    ],
  };

  return (
    <div className="home">
      <Header sections={false} />
      <main id="top">
        <HouseGate />

        <section className="section intro">
          <Mark className="intro-mark" />
          <p className="eyebrow">One host · two houses</p>
          <h2>
            Snow in Bansko. Sand on the Thermaic Gulf.
            <em> {brand.tagline}</em>
          </h2>
          <p>
            Peak &amp; Palm Villas brings together two private holiday houses looked after by {brand.host}. Each is
            booked as a whole house for one group of family or friends: a chalet by the gondola for the ski season,
            and a beach house on the sand for the summer.
          </p>
          <ul className="motifs" aria-label="What Peak & Palm is about">
            {motifs.map(([icon, label]) => (
              <li key={label}>
                <Icon name={icon} size={30} />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="houses" className="section houses">
          {houses.map((house, i) => {
            const rating = ratings[i];
            return (
              <article key={house.href} className={`house-card ${i ? "is-palm" : "is-peak"}`}>
                <CardSlider photos={house.photos} href={house.href} label={house.name}>
                  <span className="house-card-badge">
                    <Icon name="star" size={14} /> {rating.score.toFixed(2)} · {rating.count} reviews
                  </span>
                </CardSlider>
                <div className="house-card-body">
                  <p className="eyebrow">
                    {house.side} · {house.season}
                  </p>
                  <h3>
                    <a href={house.href}>{house.name}</a>
                  </h3>
                  <p className="house-card-place">
                    <Icon name="pin" size={16} /> {house.place}
                  </p>
                  <p>{house.summary}</p>
                  <dl className="house-card-facts">
                    {house.facts.map(([value, label]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <ul className="house-card-highlights">
                    {house.highlights.map(([icon, label]) => (
                      <li key={label}>
                        <Icon name={icon} size={18} /> {label}
                      </li>
                    ))}
                  </ul>
                  <div className="house-card-actions">
                    <a className="button primary" href={house.href}>
                      See the house <Icon name="arrow" size={18} />
                    </a>
                    <a className="button ghost" href={`${house.href}#stay`}>
                      Book direct −{DIRECT_DISCOUNT_LABEL}
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="section how">
          <div className="section-head centered">
            <p className="eyebrow">Booking with us</p>
            <h2>Book direct, pay {DIRECT_DISCOUNT_LABEL} less</h2>
            <p className="how-lede">
              Every stay booked on this site costs {DIRECT_DISCOUNT_LABEL} less than the same dates on Airbnb. Same houses,
              same host, no platform in between.
            </p>
          </div>
          <ol className="how-steps">
            <li>
              <Icon name="calendar" size={28} />
              <h3>Pick your dates</h3>
              <p>Each house shows its open nights live. Choose yours to see the Airbnb price next to your direct price.</p>
            </li>
            <li>
              <Icon name="chat" size={28} />
              <h3>Request at {DIRECT_DISCOUNT_LABEL} off</h3>
              <p>Send your nights and guests here. A request does not book or charge anything.</p>
            </li>
            <li>
              <Icon name="key" size={28} />
              <h3>{brand.host} confirms</h3>
              <p>The host writes back by email to confirm your stay at the direct price.</p>
            </li>
          </ol>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
    </div>
  );
}
