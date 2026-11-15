import { getProperty, type PropertyId } from "./properties";
import { FALLBACK_KEY, freshApiKey, pdpSectionsUrl, requestSections } from "./pricing";

/**
 * Guest reviews, read live from the Airbnb listing (read-only, cached for 6 hours).
 * Nothing is invented: if Airbnb doesn't answer, the carousel is simply hidden,
 * unless reviews are copied into HAND_PICKED below.
 */
export type Review = {
  id: string;
  name: string;
  date: string;
  rating: number | null;
  text: string;
  translated: boolean;
  /** A review from a guest who booked on this site (collected after check-out). */
  verified?: boolean;
};

/**
 * Real Airbnb reviews, copied word for word from the listings on 15 Nov 2026 (first name, month, stars).
 * Shown on the house pages when the live Airbnb reviews can't be read. "translated": Airbnb's own
 * English translation of a review written in another language.
 */
const HAND_PICKED: Record<PropertyId, Review[]> = {
  kaja: [
    {
      id: "airbnb-kaja-jayne-2026-03",
      name: "Jayne",
      date: "March 2026",
      rating: 5,
      translated: false,
      text: "This is a perfect place for a group or family. It's so spacious and has everything you need to make a relaxing and comfortable stay. It was refreshing to have a supply of all the kitchen and bathroom essentials, as well as tea and coffee, and is spotlessly clean. There's plenty of comfortable spaces to relax after a day on the slopes. Frosina responded quickly to all our messages and organised our airport transfer and booked our ski hire which was so helpful. We arrived very late but we were met on arrival with a warm welcome and shown around the villa which was great after a long journey. The villa is really close to the gondola and all local amenities and is a short walk to the old town. We would highly recommend and would definitely stay again if visiting Bansko!",
    },
    {
      id: "airbnb-kaja-saxon-2026-03",
      name: "Saxon",
      date: "March 2026",
      rating: 5,
      translated: false,
      text: "Fantastic place to stay for a ski holiday - short walk to the gondola to the slopes. Frosina was super communicative, organised our ski hire and transfers for very reasonable price, and it all worked seamlessly. 5 en suite rooms so it was great for our group. Thank you!",
    },
    {
      id: "airbnb-kaja-max-2026-03",
      name: "Max",
      date: "March 2026",
      rating: 5,
      translated: false,
      text: "We really liked the apartment and location. The house was clean, spacious and very cool. The host was very responsive and helpful. We were skiing and it was a short walk to the gondola which was very helpful. It is also a 2 minute walk to the main road where there are lots of great bars and restaurants. Overall we had a 10/10 experience",
    },
    {
      id: "airbnb-kaja-alex-2026-03",
      name: "Alex",
      date: "March 2026",
      rating: 5,
      translated: false,
      text: "Very nice place to stay, and very helpful and responsive host. Organised airport transfers and ski hire for us and all worked very well.",
    },
    {
      id: "airbnb-kaja-simon-2026-03",
      name: "Simon",
      date: "March 2026",
      rating: 5,
      translated: false,
      text: "Perfect for our stay, especially the communal areas. Sauna was added bonus to the stay.",
    },
    {
      id: "airbnb-kaja-kimberley-2026-02",
      name: "Kimberley",
      date: "February 2026",
      rating: 5,
      translated: false,
      text: "Great value and great location just a 5 minute walk from the lift. Frosina was so helpful with organising transfers from the airport and rental gear for us, so our journey in was incredibly seamless. The place itself is very spacious, we enjoyed the convenience of having ensuite bathrooms and our own sauna. Would definitely stay again!",
    },
    {
      id: "airbnb-kaja-guy-2026-02",
      name: "Guy",
      date: "February 2026",
      rating: 5,
      translated: false,
      text: "Such a great spot in the middle of town. Close to everything. So much room and amenities. Frosina our host was very accomodating and kind. Helped us with local recommendations and communication. Lovely place to stay. Perfect for 8 of us. Highly recommend.",
    },
    {
      id: "airbnb-kaja-josh-2025-04",
      name: "Josh",
      date: "April 2025",
      rating: 5,
      translated: false,
      text: "Very responsive any issue we had was resolved within minutes.Highly recommended!",
    },
  ],
  janis: [
    {
      id: "airbnb-janis-edith-2026-09",
      name: "Edith",
      date: "September 2026",
      rating: 5,
      translated: false,
      text: "Frosina!! What a great stay!!! Thank you so much for being available to us during our stay!!!! I can’t wait for us to come back! We have family now in Greece and we loved the house and your hospitality.",
    },
    {
      id: "airbnb-janis-desisalva-2026-08",
      name: "Desisalva",
      date: "August 2026",
      rating: 5,
      translated: false,
      text: "We had a wonderful stay! The house is absolutely beautiful, cozy, and comfortable, and my family and I truly felt at home. The location is perfect and made our stay even more enjoyable. Our host was fantastic — incredibly kind, helpful, and responsive throughout our stay. He made us feel very welcome and was always there when we needed anything. We had a great experience and would definitely love to visit again. Highly recommended! ❤️",
    },
    {
      id: "airbnb-janis-fanni-2026-07",
      name: "Fanni",
      date: "July 2026",
      rating: 5,
      translated: true,
      text: "It's very cozy and comfortable. Each room has its own bathroom. There's a fully equipped kitchen. Our large family fit comfortably. There was a crib for our 1-year-old baby and a high chair. The beach is a 1-minute walk away. We also received a beach umbrella, a sun lounger, and a camping chair, which is advantageous by the beach. Frosina recommended restaurants and things to see in the area. They are very kind and helpful, and they answered immediately to anything we asked. I can only recommend it!",
    },
    {
      id: "airbnb-janis-dan-2026-07",
      name: "Dan",
      date: "July 2026",
      rating: 5,
      translated: false,
      text: "Great host, great house with all the faciloties. . We were 9. It was more that we needed. Many thanks.",
    },
    {
      id: "airbnb-janis-aron-2026-05",
      name: "Aron",
      date: "May 2026",
      rating: 5,
      translated: true,
      text: "The hosts were very friendly and gave us a nice welcome. The surroundings and the house are superbly designed for a beach vacation. Shopping and restaurants are within easy walking distance and in beautiful surroundings, but may be more difficult for older people to manage (without a car or similar).",
    },
    {
      id: "airbnb-janis-anna-emilia-2025-09",
      name: "Anna-Emilia",
      date: "September 2025",
      rating: 5,
      translated: false,
      text: "The house was very nice and clean. The host made us feel very welcomed.",
    },
    {
      id: "airbnb-janis-michaela-2025-07",
      name: "Michaela",
      date: "July 2025",
      rating: 5,
      translated: true,
      text: "I was there with my family for 6 days. We have been warmly welcomed. We were even allowed to enter the accommodation much earlier than planned. We were shown and explained everything. We stayed with 7 adults in the accommodation and felt very comfortable, we lacked nothing, everything was very nicely decorated and very clean. A big compliment to Frosina. We would book this place again anytime.",
    },
    {
      id: "airbnb-janis-tomas-2025-07",
      name: "Tomas",
      date: "July 2025",
      rating: 5,
      translated: true,
      text: "Lovely place with great hosts! The house is located in an extremely convenient location 1 minute from the beach - directly on the first line, with plenty of parking spaces. The house is large, spacious, cool and has everything you need for your vacation.",
    },
    {
      id: "airbnb-janis-liz-2025-05",
      name: "Liz",
      date: "May 2025",
      rating: 4,
      translated: false,
      text: "Frosina has been a fantastic host and we’ve had a wonderful time staying at her place. The location is incredible, with many tavernas and the beach being so close. Frosina provided beach chairs, towels and even a bucket for the kids! The views ans sunsets were stunning. The house was extremely well equipped and Frosina generously provided some sweet treats, water and various other bits and bobs we needed. The beds were very comfortable and we all slept well, especially after being active all day at the many locations worth visiting nearby. There is aircon in all the rooms but closing the blinds during the day meant we didn’t need to use it. We had a small issue during our stay and Frosina was extremely helpful - her communication has been brilliant throughout. We hope to visit again! Super place! Super host!",
    },
    {
      id: "airbnb-janis-adriana-2024-09",
      name: "Адриана",
      date: "September 2024",
      rating: 5,
      translated: false,
      text: "We had an amazing stay at this beautiful house, just a minute away from the beach and surrounded by exotic restaurants. The beach was peaceful, the water was clear, and it had shallow areas, perfect for relaxing. Parking was not an issue, there is a plenty of spaces. The house itself was incredibly clean and spacious, with multiple terraces and bathrooms, and it had everything we needed for a comfortable stay. The hosts were very kind and provided detailed information about the house and nearby attractions. We highly recommend it to anyone looking for a relaxing getaway!",
    },
  ],
};

const MAX_REVIEWS = 10;
const MAX_CHARS = 520;
const REVALIDATE = 6 * 3600;
const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function clean(text: string) {
  const plain = text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "’")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= MAX_CHARS) return plain;
  const cut = plain.slice(0, MAX_CHARS);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), MAX_CHARS - 40)).replace(/[,.;:!?\s]+$/, "")}…`;
}

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Accepts the shapes Airbnb uses for a review anywhere inside a response. */
export function toReview(o: Raw): Review | null {
  const reviewer = (o.reviewer ?? o.author) as Raw | undefined;
  const original = str(o.comments);
  if (!original || !reviewer || typeof reviewer !== "object") return null;
  const localized = o.localizedReview as Raw | null | undefined;
  const translatedText = localized && typeof localized === "object" ? str(localized.comments) : "";
  const language = str(o.language).toLowerCase();
  const useTranslation = Boolean(translatedText) && language !== "" && !language.startsWith("en");
  const text = clean(useTranslation ? translatedText : original);
  if (text.length < 30) return null;
  const rating = typeof o.rating === "number" ? o.rating : null;
  if (rating !== null && rating < 4) return null;
  const name = str(reviewer.firstName ?? reviewer.first_name ?? reviewer.smartName ?? reviewer.name).trim() || "Guest";
  return {
    id: String(o.id ?? `${name}-${text.slice(0, 24)}`),
    name: name.slice(0, 40),
    date: str(o.localizedDate ?? o.localized_date).slice(0, 40),
    rating,
    text,
    translated: useTranslation,
  };
}

/** Walks any JSON value and collects review-like objects, in order. */
export function collectReviews(value: unknown, out: Review[] = [], seen = new Set<string>(), depth = 0): Review[] {
  if (!value || typeof value !== "object" || depth > 40 || out.length >= MAX_REVIEWS * 3) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectReviews(item, out, seen, depth + 1);
    return out;
  }
  const review = toReview(value as Raw);
  if (review) {
    const key = review.id;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(review);
    }
    return out;
  }
  for (const child of Object.values(value as Raw)) collectReviews(child, out, seen, depth + 1);
  return out;
}

/**
 * Airbnb's own reviews query (the one behind "Show all reviews"). Airbnb rotates the query
 * version now and then, so several known versions are tried; AIRBNB_REVIEWS_HASH overrides them.
 */
const REVIEWS_HASHES = [
  process.env.AIRBNB_REVIEWS_HASH?.trim(),
  "2ed951bfedf71b87d9d30e24a419e15517af9fbed7ac560a8d1cc7feadfa22e6",
  "dec1c8061483e78373602047450322fd6a37e6db1099b6e3c2e2cb35f9b66cde",
].filter((h): h is string => Boolean(h));

function reviewsRequest(listingId: string, hash: string) {
  const variables = {
    id: Buffer.from(`StayListing:${listingId}`).toString("base64"),
    pdpReviewsRequest: {
      fieldSelector: "for_p3_translation_only",
      forPreview: false,
      limit: 24,
      first: 24,
      offset: "0",
      showingTranslationButton: false,
      sortingPreference: "MOST_RECENT",
    },
  };
  const extensions = { persistedQuery: { version: 1, sha256Hash: hash } };
  const url = new URL(`https://www.airbnb.com/api/v3/StaysPdpReviewsQuery/${hash}`);
  url.searchParams.set("operationName", "StaysPdpReviewsQuery");
  url.searchParams.set("locale", "en");
  url.searchParams.set("currency", "EUR");
  url.searchParams.set("variables", JSON.stringify(variables));
  url.searchParams.set("extensions", JSON.stringify(extensions));
  return { url, body: JSON.stringify({ operationName: "StaysPdpReviewsQuery", variables, extensions }) };
}

async function fromReviewsQuery(listingId: string, notes: string[]) {
  const keys = [FALLBACK_KEY];
  for (const hash of REVIEWS_HASHES) {
    for (const method of ["GET", "POST"] as const) {
      const { url, body } = reviewsRequest(listingId, hash);
      const response = await fetch(url, {
        method,
        body: method === "POST" ? body : undefined,
        headers: {
          "User-Agent": BROWSER,
          Accept: "application/json",
          "Accept-Language": "en",
          "Content-Type": "application/json",
          "X-Airbnb-Api-Key": keys[0],
        },
        next: { revalidate: REVALIDATE },
      });
      const raw = await response.text().catch(() => "");
      let data: unknown = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
      const reviews = data ? collectReviews(data) : [];
      if (reviews.length) return reviews;
      const error =
        (data as { errors?: Array<{ message?: string }> } | null)?.errors?.[0]?.message ??
        raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      notes.push(`${hash.slice(0, 6)} ${method} ${response.status}${error ? ` "${error.slice(0, 70)}"` : ""}`);
    }
  }
  return [];
}

async function fromSections(listingId: string) {
  const url = pdpSectionsUrl(listingId, { sectionIds: ["REVIEWS_DEFAULT"], translateUgc: true });
  let data = await requestSections(url, FALLBACK_KEY, REVALIDATE);
  let reviews = data ? collectReviews(data) : [];
  if (!reviews.length) {
    const key = await freshApiKey();
    if (key && key !== FALLBACK_KEY) {
      data = await requestSections(url, key, REVALIDATE);
      reviews = data ? collectReviews(data) : [];
    }
  }
  return reviews;
}

async function fromListingPage(pageUrl: string) {
  const response = await fetch(pageUrl, {
    headers: { "User-Agent": BROWSER, "Accept-Language": "en" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) return [];
  const html = await response.text();
  const reviews: Review[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)) {
    if (!match[1].includes('"comments"')) continue;
    try {
      collectReviews(JSON.parse(match[1]), reviews, seen);
    } catch {
      // not JSON we can read
    }
  }
  return reviews;
}

export type ReviewsReport = { reviews: Review[]; source: "airbnb-reviews" | "airbnb-page" | "hand-picked" | "none"; notes: string[] };

/** Reviews plus where they came from (shown on /admin so you can see if Airbnb answered). */
export async function loadAirbnbReviews(id: PropertyId): Promise<ReviewsReport> {
  const house = getProperty(id);
  const notes: string[] = [];
  const tidy = (list: Review[]) => {
    // English first (or translated), longer reviews first within Airbnb's order otherwise.
    const rank = (r: Review) => (r.text.length >= 60 ? 0 : 2) + (/[a-z]{3,}.*\b(the|and|was|we)\b/i.test(r.text) ? 0 : 1);
    return [...list].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_REVIEWS);
  };
  const attempts: Array<[ReviewsReport["source"], () => Promise<Review[]>]> = [
    ["airbnb-reviews", () => fromReviewsQuery(house.airbnbId, notes)],
    ["airbnb-page", () => fromSections(house.airbnbId)],
    ["airbnb-page", () => fromListingPage(house.airbnbUrl)],
  ];
  for (const [source, attempt] of attempts) {
    try {
      const found = await attempt();
      if (found.length) return { reviews: tidy(found), source, notes };
    } catch (error) {
      notes.push(`${source}: ${(error as Error).message.slice(0, 80)}`);
    }
  }
  if (HAND_PICKED[id].length) {
    return { reviews: HAND_PICKED[id].slice(0, MAX_REVIEWS).map((r) => ({ ...r, text: clean(r.text) })), source: "hand-picked", notes };
  }
  console.warn(`No Airbnb reviews for ${id}:`, notes.join("; ") || "nothing returned");
  return { reviews: [], source: "none", notes };
}

export async function fetchAirbnbReviews(id: PropertyId): Promise<Review[]> {
  return (await loadAirbnbReviews(id)).reviews;
}
