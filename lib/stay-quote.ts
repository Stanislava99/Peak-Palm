import { dbConfigured } from "./db";
import { getPriceList, priceFromList } from "./price-list";
import { fetchStayQuote, type QuoteLine, type QuoteResult } from "./pricing";
import type { PropertyId } from "./properties";

/**
 * The price of a stay (server only): the live Airbnb price minus 10%, or, when Airbnb doesn't return
 * a price, the hosts' own price list (admin → Prices). If Airbnb says the dates are unavailable,
 * that answer stands (no fallback).
 */
export async function quoteStay(property: PropertyId, checkIn: string, checkOut: string, guests: number): Promise<QuoteResult> {
  const live = await fetchStayQuote(property, checkIn, checkOut, guests);
  if (live.ok || live.reason !== "no-price") return live;
  return (await priceListQuote(property, checkIn, checkOut, guests)) ?? live;
}

async function priceListQuote(property: PropertyId, checkIn: string, checkOut: string, guests: number): Promise<QuoteResult | null> {
  if (!dbConfigured()) return null;
  try {
    const priced = priceFromList(await getPriceList(), property, checkIn, checkOut, guests);
    if (!priced) return null;
    const lines: QuoteLine[] = [{ label: `${priced.nights} night${priced.nights === 1 ? "" : "s"}`, amount: priced.nightsTotal }];
    if (priced.extraTotal > 0) {
      lines.push({
        label: `${priced.extraGuests} extra guest${priced.extraGuests === 1 ? "" : "s"} × ${priced.nights} night${priced.nights === 1 ? "" : "s"}`,
        amount: priced.extraTotal,
      });
    }
    if (priced.cleaning > 0) lines.push({ label: "Cleaning fee", amount: priced.cleaning });
    return {
      ok: true,
      quote: {
        currency: "EUR",
        nights: priced.nights,
        guests,
        airbnbTotal: null,
        airbnbLabel: "",
        directTotal: priced.total,
        savings: null,
        source: "price-list",
        perNight: Math.round(priced.total / priced.nights),
        lines,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.warn("Price list unavailable", (error as Error).message);
    return null;
  }
}
