import { dbConfigured } from "./db";
import { discountLabel, getPriceList, priceFromList, stayDiscount, type PriceList } from "./price-list";
import { fetchStayQuote, type QuoteLine, type QuoteResult } from "./pricing";
import type { PropertyId } from "./properties";

/**
 * The price of a stay (server only).
 * 1. The hosts' price list (admin → Prices: the same prices as on Airbnb), less their direct-booking
 *    discount, when every night has a price.
 * 2. Otherwise the live Airbnb price, less the same discount (average over the nights).
 * Availability is checked separately (calendar, checkout and reserve APIs).
 */
export async function quoteStay(property: PropertyId, checkIn: string, checkOut: string, guests: number): Promise<QuoteResult> {
  const list = await loadList();
  if (list) {
    const fromList = priceListQuote(list, property, checkIn, checkOut, guests);
    if (fromList) return fromList;
  }
  const live = await fetchStayQuote(property, checkIn, checkOut, guests);
  if (!live.ok || !list || live.quote.airbnbTotal === null) return live;
  // Apply the hosts' discount (not the built-in 10%) to the live Airbnb price.
  const pct = stayDiscount(list, property, checkIn, checkOut);
  const directTotal = Math.round(live.quote.airbnbTotal * (1 - pct / 100));
  return {
    ok: true,
    quote: {
      ...live.quote,
      directTotal,
      savings: Math.round(live.quote.airbnbTotal - directTotal) || null,
      discountPct: Math.round(pct * 10) / 10,
      perNight: Math.round(directTotal / live.quote.nights),
    },
  };
}

async function loadList(): Promise<PriceList | null> {
  if (!dbConfigured()) return null;
  try {
    return await getPriceList();
  } catch (error) {
    console.warn("Price list unavailable", (error as Error).message);
    return null;
  }
}

function priceListQuote(list: PriceList, property: PropertyId, checkIn: string, checkOut: string, guests: number): QuoteResult | null {
  const priced = priceFromList(list, property, checkIn, checkOut, guests);
  if (!priced) return null;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const lines: QuoteLine[] = [{ label: plural(priced.nights, "night"), amount: priced.nightsTotal }];
  if (priced.extraTotal > 0) {
    lines.push({ label: `${plural(priced.extraGuests, "extra guest")} × ${plural(priced.nights, "night")}`, amount: priced.extraTotal });
  }
  if (priced.cleaning > 0) lines.push({ label: "Cleaning fee", amount: priced.cleaning });
  if (priced.discountAmount > 0) lines.push({ label: `Direct-booking discount (${discountLabel(priced.discountPct)})`, amount: -priced.discountAmount });
  return {
    ok: true,
    quote: {
      currency: "EUR",
      nights: priced.nights,
      guests,
      airbnbTotal: priced.discountAmount > 0 ? Math.round(priced.listTotal) : null,
      airbnbLabel: "Same dates at Airbnb prices",
      directTotal: priced.total,
      savings: priced.discountAmount > 0 ? Math.round(priced.listTotal) - priced.total : null,
      discountPct: priced.discountPct,
      source: "price-list",
      perNight: Math.round(priced.total / priced.nights),
      lines,
      fetchedAt: new Date().toISOString(),
    },
  };
}
