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
  if (HAND_PICKED[id].length) return { reviews: HAND_PICKED[id], source: "hand-picked", notes };
  console.warn(`No Airbnb reviews for ${id}:`, notes.join("; ") || "nothing returned");
  return { reviews: [], source: "none", notes };
}

export async function fetchAirbnbReviews(id: PropertyId): Promise<Review[]> {
  return (await loadAirbnbReviews(id)).reviews;
}
