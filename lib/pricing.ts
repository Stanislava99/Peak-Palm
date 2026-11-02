import { getProperty, type PropertyId } from "./properties";
import { nightsBetween } from "./stay";

/** Booking on the site is this much cheaper than the Airbnb total. */
export const DIRECT_DISCOUNT = 0.1;
export const DIRECT_DISCOUNT_LABEL = `${Math.round(DIRECT_DISCOUNT * 100)}%`;

const CURRENCY = "EUR";
const FALLBACK_KEY = "d306zoyjsyarp7ifhu67rjxn52tv0t20";
/** Airbnb’s persisted query for the listing page sections (same one the booking box uses). */
const PDP_HASH = "80c7889b4b0027d99ffea830f6c0d4911a6e863a957cbe1044823f0fc746bf1f";
const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type QuoteLine = { label: string; amount: number };

export type StayQuote = {
  currency: typeof CURRENCY;
  nights: number;
  guests: number;
  /** What the same stay costs on Airbnb, all fees included (before taxes if Airbnb shows it that way). */
  airbnbTotal: number;
  airbnbLabel: string;
  directTotal: number;
  savings: number;
  perNight: number;
  lines: QuoteLine[];
  fetchedAt: string;
};

export type QuoteResult = { ok: true; quote: StayQuote } | { ok: false; reason: "unavailable" | "no-price"; message: string };

export function directPrice(airbnbTotal: number) {
  return Math.round(airbnbTotal * (1 - DIRECT_DISCOUNT));
}

export function formatMoney(amount: number, currency = CURRENCY) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** "€1,234.50" / "-€80" / "1.234,50 €" → number. */
export function parseMoney(text: unknown): number | null {
  if (typeof text !== "string") return null;
  const negative = /^\s*[-−–]/.test(text) || /\(.*\)/.test(text);
  let digits = text.replace(/[^\d.,]/g, "");
  if (!digits) return null;
  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  if (lastComma > lastDot && digits.length - lastComma === 3) {
    digits = digits.replace(/\./g, "").replace(",", ".");
  } else {
    digits = digits.replace(/,/g, "");
  }
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

type PriceItem = { description?: string; priceString?: string };

/** Pulls the Airbnb total out of a StaysPdpSections response. Exported for tests. */
export function parseAirbnbQuote(
  data: unknown,
  nights: number,
): { total: number; label: string; lines: QuoteLine[] } | { unavailable: string } | null {
  const sections = (get(data, "data.presentation.stayProductDetailPage.sections.sections") as unknown[]) ?? [];
  const sidebar = sections.find((s) => get(s, "sectionId") === "BOOK_IT_SIDEBAR");
  const unavailable = get(sidebar, "section.localizedUnavailabilityMessage");
  if (typeof unavailable === "string" && unavailable) return { unavailable };

  const price = get(sidebar, "section.structuredDisplayPrice") ?? get(data, "data.presentation.stayProductDetailPage.sections.metadata.bookingPrefetchData.barPrice");
  const groups = ((get(price, "explanationData.priceDetails") ?? get(price, "explanationData.priceGroups")) as unknown[]) ?? [];
  const items: PriceItem[] = groups.flatMap((group) => ((get(group, "items") as PriceItem[]) ?? []).filter((i) => i && typeof i === "object"));

  const lines: QuoteLine[] = [];
  let total: number | null = null;
  let label = "Airbnb total";
  for (const item of items) {
    const amount = parseMoney(item.priceString);
    if (!item.description || amount === null) continue;
    if (/^total/i.test(item.description.trim())) {
      total = amount;
      label = item.description.trim();
    } else {
      lines.push({ label: item.description.trim(), amount });
    }
  }

  if (total === null && lines.length) {
    total = lines.reduce((sum, line) => sum + line.amount, 0);
  }

  if (total === null) {
    const primary = get(price, "primaryLine");
    const shown = parseMoney(get(primary, "discountedPrice") ?? get(primary, "price") ?? get(primary, "originalPrice"));
    const qualifier = String(get(primary, "qualifier") ?? get(primary, "accessibilityLabel") ?? "").toLowerCase();
    if (shown !== null) {
      total = /night/.test(qualifier) && !/nights/.test(qualifier) ? shown * nights : shown;
    }
  }

  if (total === null || !(total > 0)) return null;
  return { total: Math.round(total * 100) / 100, label, lines };
}

async function freshApiKey(): Promise<string | null> {
  try {
    const response = await fetch("https://www.airbnb.com/", {
      headers: { "User-Agent": BROWSER, "Accept-Language": "en" },
      next: { revalidate: 86_400 },
    });
    const html = await response.text();
    return html.match(/"api_config":\{"key":"([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function quoteUrl(listingId: string, checkIn: string, checkOut: string, guests: number) {
  const encode = (prefix: string) => Buffer.from(`${prefix}:${listingId}`).toString("base64");
  const variables = {
    id: encode("StayListing"),
    demandStayListingId: encode("DemandStayListing"),
    pdpSectionsRequest: {
      adults: String(guests),
      bypassTargetings: false,
      categoryTag: null,
      causeId: null,
      children: null,
      disasterId: null,
      discountedGuestFeeVersion: null,
      displayExtensions: null,
      federatedSearchId: null,
      forceBoostPriorityMessageType: null,
      infants: null,
      interactionType: null,
      layouts: ["SIDEBAR", "SINGLE_COLUMN"],
      pets: 0,
      pdpTypeOverride: null,
      photoId: null,
      preview: false,
      previousStateCheckIn: null,
      previousStateCheckOut: null,
      priceDropSource: null,
      privateBooking: false,
      promotionUuid: null,
      relaxedAmenityIds: null,
      searchId: null,
      selectedCancellationPolicyId: null,
      selectedRatePlanId: null,
      splitStays: null,
      staysBookingMigrationEnabled: false,
      translateUgc: null,
      useNewSectionWrapperApi: false,
      sectionIds: ["BOOK_IT_SIDEBAR", "BOOK_IT_FLOATING_FOOTER"],
      checkIn,
      checkOut,
    },
  };
  const url = new URL(`https://www.airbnb.com/api/v3/StaysPdpSections/${PDP_HASH}`);
  url.searchParams.set("operationName", "StaysPdpSections");
  url.searchParams.set("locale", "en");
  url.searchParams.set("currency", CURRENCY);
  url.searchParams.set("variables", JSON.stringify(variables));
  url.searchParams.set("extensions", JSON.stringify({ persistedQuery: { version: 1, sha256Hash: PDP_HASH } }));
  return url;
}

async function requestQuote(url: URL, key: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": BROWSER,
      Accept: "application/json",
      "Accept-Language": "en",
      "Content-Type": "application/json",
      "X-Airbnb-Api-Key": key,
    },
    next: { revalidate: 1800 },
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

/** Live Airbnb total for these dates, and the direct price 10% below it. */
export async function fetchStayQuote(
  property: PropertyId,
  checkIn: string,
  checkOut: string,
  guests: number,
): Promise<QuoteResult> {
  const nights = nightsBetween(checkIn, checkOut);
  const noPrice: QuoteResult = {
    ok: false,
    reason: "no-price",
    message: "Airbnb didn’t return a price for these dates just now.",
  };
  if (nights <= 0) return noPrice;

  const url = quoteUrl(getProperty(property).airbnbId, checkIn, checkOut, guests);
  try {
    let data = await requestQuote(url, FALLBACK_KEY);
    let parsed = data ? parseAirbnbQuote(data, nights) : null;
    if (!parsed) {
      const key = await freshApiKey();
      if (key && key !== FALLBACK_KEY) {
        data = await requestQuote(url, key);
        parsed = data ? parseAirbnbQuote(data, nights) : null;
      }
    }
    if (!parsed) return noPrice;
    if ("unavailable" in parsed) return { ok: false, reason: "unavailable", message: parsed.unavailable };

    const directTotal = directPrice(parsed.total);
    return {
      ok: true,
      quote: {
        currency: CURRENCY,
        nights,
        guests,
        airbnbTotal: parsed.total,
        airbnbLabel: parsed.label,
        directTotal,
        savings: Math.round(parsed.total - directTotal),
        perNight: Math.round(directTotal / nights),
        lines: parsed.lines,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch {
    return noPrice;
  }
}
