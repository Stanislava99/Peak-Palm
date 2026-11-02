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
};

/**
 * Optional: paste real Airbnb reviews here (exact text, first name, month) to show them
 * when the live listing can't be read. Leave empty to show only live reviews.
 */
const HAND_PICKED: Record<PropertyId, Review[]> = { kaja: [], janis: [] };

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

export async function fetchAirbnbReviews(id: PropertyId): Promise<Review[]> {
  const house = getProperty(id);
  let reviews: Review[] = [];
  try {
    reviews = await fromSections(house.airbnbId);
  } catch {
    reviews = [];
  }
  if (!reviews.length) {
    try {
      reviews = await fromListingPage(house.airbnbUrl);
    } catch {
      reviews = [];
    }
  }
  if (!reviews.length) reviews = HAND_PICKED[id];
  // Prefer reviews with something to say, keep Airbnb's order otherwise.
  return reviews.filter((r) => r.text.length >= 60).concat(reviews.filter((r) => r.text.length < 60)).slice(0, MAX_REVIEWS);
}
