import { dbConfigured } from "@/lib/db";
import { currentAdmin } from "@/lib/host-auth";
import { blockRange, deleteBlock, unblockRange } from "@/lib/blocked-nights";
import { addPeriod, clearRange, deletePeriod, setDefaults, setRange } from "@/lib/price-list";
import { isPropertyId } from "@/lib/properties";
import { NO_STORE, guard } from "@/lib/security";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Pages are cached for 30 minutes; refresh them so new prices, minimum stays and discounts show at once. */
function refreshHousePages() {
  // The whole site: house pages show prices, and every page's header shows the discount.
  revalidatePath("/", "layout");
}

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: NO_STORE });

/** Reads a euro amount: "", null → null; otherwise a positive number with at most 2 decimals. */
function amount(value: unknown, { allowZero = false } = {}): number | null | "bad" {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0) || n > 100_000) return "bad";
  return Math.round(n * 100) / 100;
}

/** Reads a discount in % (0–90, up to 1 decimal): "", null → null. */
function percent(value: unknown): number | null | "bad" {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", ".").replace("%", "").trim());
  if (!Number.isFinite(n) || n < 0 || n > 90) return "bad";
  return Math.round(n * 10) / 10;
}

/** Reads a whole number of nights (1–60): "", null → null. */
function nights(value: unknown): number | null | "bad" {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : "bad";
}

/** The hosts' price list (used when Airbnb doesn't return a price). Admins only. */
export async function POST(request: Request) {
  const blocked = await guard(request, "admin-prices", [[60, 10 * 60_000]]);
  if (blocked) return blocked;
  const admin = await currentAdmin();
  if (!admin) return fail("Please log in again.", 401);
  if (!dbConfigured()) return fail("The price list needs the database (Neon), which isn’t connected on this site.", 503);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Nothing was sent.");

  if (body.action === "defaults") {
    if (typeof body.property !== "string" || !isPropertyId(body.property)) return fail("Choose a house.");
    const nightly = amount(body.nightly);
    const cleaning = amount(body.cleaning, { allowZero: true });
    if (nightly === "bad") return fail("The default nightly price must be a number above 0, or empty.");
    if (cleaning === "bad") return fail("The cleaning fee must be a number (0 or more).");
    const minNights = nights(body.minNights);
    if (minNights === "bad") return fail("Minimum nights must be a whole number from 1 to 60.");
    const includedGuests = nights(body.includedGuests);
    if (includedGuests === "bad" || (includedGuests !== null && includedGuests > 30)) return fail("“Price covers up to” must be a number of guests from 1 to 30.");
    const extraGuest = amount(body.extraGuest, { allowZero: true });
    if (extraGuest === "bad") return fail("The extra-guest price must be a number (0 or more).");
    if (extraGuest && !includedGuests) return fail("Say how many guests the nightly price covers, so the site knows when extra guests start.");
    const discount = percent(body.discount);
    if (discount === "bad") return fail("The discount must be a number from 0 to 90 (%).");
    await setDefaults(body.property, { nightly, cleaning: cleaning ?? 0, minNights: minNights ?? 1, includedGuests, extraGuest: extraGuest ?? 0, discount: discount ?? 10 }, admin);
    refreshHousePages();
    return NextResponse.json({ ok: true, message: "Saved. The new prices apply to the next guest who looks at the calendar." }, { headers: NO_STORE });
  }

  if (body.action === "add-period") {
    if (typeof body.property !== "string" || !isPropertyId(body.property)) return fail("Choose a house.");
    const from = String(body.from ?? "");
    const to = String(body.to ?? "");
    if (!DATE.test(from) || !DATE.test(to)) return fail("Choose the first and the last night.");
    if (to < from) return fail("The last night must be on or after the first night.");
    const nightly = amount(body.nightly);
    if (nightly === null || nightly === "bad") return fail("Enter a nightly price above 0.");
    const label = String(body.label ?? "").trim().slice(0, 60);
    const minNights = nights(body.minNights);
    if (minNights === "bad") return fail("Minimum nights must be a whole number from 1 to 60.");
    await addPeriod({ property: body.property, from, to, nightly, label, minNights, discount: null }, admin);
    refreshHousePages();
    return NextResponse.json({ ok: true, message: "Price period added." }, { headers: NO_STORE });
  }

  if (body.action === "set-range" || body.action === "clear-range") {
    if (typeof body.property !== "string" || !isPropertyId(body.property)) return fail("Choose a house.");
    const from = String(body.from ?? "");
    const to = String(body.to ?? "");
    if (!DATE.test(from) || !DATE.test(to)) return fail("Choose the nights on the calendar first.");
    if (to < from) return fail("The last night must be on or after the first night.");
    if (Date.parse(to) - Date.parse(from) > 400 * 86_400_000) return fail("Please choose at most about a year at a time.");
    if (body.action === "clear-range") {
      await clearRange(body.property, from, to);
      refreshHousePages();
      return NextResponse.json({ ok: true, message: "Done. Those nights use the standard price again." }, { headers: NO_STORE });
    }
    const nightly = amount(body.nightly);
    if (nightly === null || nightly === "bad") return fail("Enter a price per night above 0.");
    const minNights = nights(body.minNights);
    if (minNights === "bad") return fail("Minimum stay must be a whole number of nights from 1 to 60.");
    const label = String(body.label ?? "").trim().slice(0, 60);
    const discount = percent(body.discount);
    if (discount === "bad") return fail("The discount must be a number from 0 to 90 (%), or empty for the standard discount.");
    await setRange({ property: body.property, from, to, nightly, label, minNights, discount }, admin);
    refreshHousePages();
    const count = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
    return NextResponse.json({ ok: true, message: `Saved. ${count === 1 ? "That night" : `Those ${count} nights`} now cost €${nightly} a night.` }, { headers: NO_STORE });
  }

  if (body.action === "block-range" || body.action === "unblock-range") {
    if (typeof body.property !== "string" || !isPropertyId(body.property)) return fail("Choose a house.");
    const from = String(body.from ?? "");
    const to = String(body.to ?? "");
    if (!DATE.test(from) || !DATE.test(to)) return fail("Choose the nights on the calendar first.");
    if (to < from) return fail("The last night must be on or after the first night.");
    if (to < new Date().toISOString().slice(0, 10)) return fail("Those nights are in the past.");
    if (Date.parse(to) - Date.parse(from) > 400 * 86_400_000) return fail("Please choose at most about a year at a time.");
    const count = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
    const what = count === 1 ? "That night" : `Those ${count} nights`;
    if (body.action === "unblock-range") {
      await unblockRange(body.property, from, to);
      refreshHousePages();
      return NextResponse.json({ ok: true, message: `${what} can be booked on your site again (unless they’re taken on Airbnb or Booking.com).` }, { headers: NO_STORE });
    }
    const note = String(body.note ?? "").trim().slice(0, 80);
    await blockRange(body.property, from, to, note, admin);
    refreshHousePages();
    return NextResponse.json({ ok: true, message: `${what} ${count === 1 ? "is" : "are"} now blocked on your site. Remember to block ${count === 1 ? "it" : "them"} on Airbnb and Booking.com too.` }, { headers: NO_STORE });
  }

  if (body.action === "delete-block") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return fail("Unknown block.");
    if (!(await deleteBlock(id))) return fail("That block was already removed.", 404);
    refreshHousePages();
    return NextResponse.json({ ok: true, message: "Unblocked. Those nights can be booked on your site again." }, { headers: NO_STORE });
  }

  if (body.action === "delete-period") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return fail("Unknown period.");
    if (!(await deletePeriod(id))) return fail("That period was already removed.", 404);
    refreshHousePages();
    return NextResponse.json({ ok: true, message: "Price period removed." }, { headers: NO_STORE });
  }

  return fail("Unknown action.");
}
