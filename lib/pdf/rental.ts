import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { brand } from "../brand";
import { formatMoney } from "../pricing";
import { priceLines, type RentalLine } from "../rentals";
import { businessDetails, isTestSite } from "../site-config";
import { formatLong } from "../stay";
import { CORMORANT_600, LOGO_LIGHT_PNG, NOTO_400, NOTO_600 } from "./assets";
import { GOLD, INK, LINE, MUTED, PINE, RED, SAND, centerText, drawSpaced, fit, rightText, wrap } from "./confirmation";

export type RentalReservation = {
  ref: string;
  name: string;
  email: string;
  phone: string;
  /** Stay at Villa Kaja, when known. */
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  /** "Booked on this site (deposit paid)", "Airbnb", … */
  bookedVia?: string;
  /** Booking reference from Airbnb / Booking.com, when the guest gave one. */
  bookingRef?: string;
  note?: string;
  lines: RentalLine[];
};

const shortDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A4 "Ski equipment & ski school reservation" for Frosina to pass to the shop. Nothing is paid. */
export async function rentalPdf(r: RentalReservation, issuedAt = new Date()): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Ski rental reservation ${r.ref}`);
  pdf.setAuthor(brand.name);
  pdf.setCreator(brand.name);
  const regular = await pdf.embedFont(Buffer.from(NOTO_400, "base64"), { subset: true });
  const bold = await pdf.embedFont(Buffer.from(NOTO_600, "base64"), { subset: true });
  const display = await pdf.embedFont(Buffer.from(CORMORANT_600, "base64"), { subset: true });
  const logo = await pdf.embedPng(Buffer.from(LOGO_LIGHT_PNG, "base64"));

  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const M = 48;
  const inner = width - M * 2;

  page.drawRectangle({ x: 0, y: height - 118, width, height: 118, color: PINE });
  const logoW = 190;
  const logoH = (logo.height / logo.width) * logoW;
  page.drawImage(logo, { x: M, y: height - 59 - logoH / 2, width: logoW, height: logoH });
  rightText(page, "SKI RENTAL & SKI SCHOOL", width - M, height - 50, bold, 9, GOLD, 1.6);
  rightText(page, "RESERVATION", width - M, height - 64, bold, 9, GOLD, 1.6);
  rightText(page, r.ref, width - M, height - 86, display, 18, SAND);
  if (isTestSite()) {
    page.drawRectangle({ x: 0, y: height - 136, width, height: 18, color: RED });
    centerText(page, "TEST DOCUMENT · NOT A REAL RESERVATION", width / 2, height - 130, bold, 8, rgb(1, 1, 1), 1.4);
  }

  let y = height - 168;
  page.drawText("Ski equipment & ski school reservation", { x: M, y, size: 24, font: display, color: PINE });
  y -= 22;
  page.drawText(`Issued ${formatLong(issuedAt.toISOString().slice(0, 10))} · reservation only, nothing paid online`, {
    x: M,
    y,
    size: 9.5,
    font: regular,
    color: MUTED,
  });

  // Guest / stay boxes
  y -= 34;
  const colW = (inner - 20) / 2;
  const stay = [
    "Villa Kaja, Bansko",
    r.checkIn && r.checkOut ? `${formatLong(r.checkIn)} – ${formatLong(r.checkOut)}` : "Stay dates not given",
    [r.guests ? `${r.guests} guest${r.guests === 1 ? "" : "s"}` : "", r.bookedVia ? `booked via ${r.bookedVia}` : "", r.bookingRef ? `ref ${r.bookingRef}` : ""]
      .filter(Boolean)
      .join(" · "),
  ].filter(Boolean);
  box(page, M, y, colW, "GUEST", [r.name, r.phone, r.email].filter(Boolean));
  box(page, M + colW + 20, y, colW, "STAY", stay);

  // Lines table
  y -= 112;
  drawSpaced(page, "RESERVED", M, y, bold, 8.5, GOLD, 1.4);
  y -= 18;
  const cols = { item: M, from: M + inner * 0.48, qty: M + inner * 0.7, price: M + inner };
  page.drawText("Item", { x: cols.item, y, size: 8.5, font: bold, color: MUTED });
  page.drawText("First day", { x: cols.from, y, size: 8.5, font: bold, color: MUTED });
  page.drawText("People × days", { x: cols.qty, y, size: 8.5, font: bold, color: MUTED });
  rightText(page, "Shop price", cols.price, y, bold, 8.5, MUTED);
  y -= 8;
  const { lines, total, someOnRequest } = priceLines(r.lines);
  for (const line of lines) {
    page.drawLine({ start: { x: M, y }, end: { x: M + inner, y }, thickness: 0.6, color: LINE });
    y -= 16;
    page.drawText(fit(line.title, bold, 10, inner * 0.48), { x: cols.item, y, size: 10, font: bold, color: INK });
    page.drawText(shortDate(line.from), { x: cols.from, y, size: 10, font: regular, color: INK });
    page.drawText(`${line.people} × ${line.days} day${line.days === 1 ? "" : "s"}`, { x: cols.qty, y, size: 10, font: regular, color: INK });
    rightText(page, line.price === null ? "on request" : line.price === 0 ? "free" : formatMoney(line.price), cols.price, y, bold, 10, INK);
    y -= 13;
    const sub =
      line.type === "lesson"
        ? line.detail.split(" · ").slice(1).join(" · ") || ""
        : "";
    if (sub) {
      page.drawText(sub, { x: cols.item, y, size: 8.5, font: regular, color: MUTED });
      y -= 6;
    } else y += 7;
  }
  page.drawLine({ start: { x: M, y }, end: { x: M + inner, y }, thickness: 0.6, color: LINE });

  // Total
  y -= 14;
  page.drawRectangle({ x: M, y: y - 52, width: inner, height: 52, color: SAND, borderColor: LINE, borderWidth: 1 });
  page.drawText("Estimated total at the shop", { x: M + 16, y: y - 22, size: 10, font: regular, color: MUTED });
  page.drawText(formatMoney(total) + (someOnRequest ? " + lessons on request" : ""), { x: M + 16, y: y - 42, size: 16, font: bold, color: PINE });
  rightText(page, "Paid online", width - M - 16, y - 22, regular, 10, MUTED);
  rightText(page, "Nothing · pay at the shop", width - M - 16, y - 42, bold, 12, INK);
  y -= 76;

  if (r.note) {
    drawSpaced(page, "GUEST NOTE", M, y, bold, 8.5, GOLD, 1.4);
    y -= 16;
    for (const part of wrap(r.note, regular, 10, inner).slice(0, 6)) {
      page.drawText(part, { x: M, y, size: 10, font: regular, color: INK });
      y -= 14;
    }
    y -= 8;
  }

  drawSpaced(page, "GOOD TO KNOW", M, y, bold, 8.5, GOLD, 1.4);
  y -= 16;
  for (const text of [
    "Prices are the partner shop’s 2026/27 price list. Equipment prices are per person for the whole rental.",
    "Ski school prices follow the season of the first lesson day (low: 12–22 Dec and 21 Mar – 11 Apr; high: 23 Dec – 20 Mar).",
    "Private group lessons are priced for 2 people; each additional person is charged per day.",
    `${brand.host} passes this reservation to the shop and confirms sizes and pick-up time with the guest.`,
  ]) {
    for (const part of wrap(text, regular, 8.8, inner - 12)) {
      page.drawText(part, { x: M + 10, y, size: 8.8, font: regular, color: MUTED });
      y -= 12.5;
    }
    page.drawCircle({ x: M + 3, y: y + 15.5, size: 1.6, color: GOLD });
    y -= 4;
  }

  const biz = businessDetails();
  page.drawLine({ start: { x: M, y: 70 }, end: { x: width - M, y: 70 }, thickness: 0.8, color: LINE });
  page.drawText(`Questions: ${biz.email} · Hosted by ${brand.host}`, { x: M, y: 54, size: 8.5, font: regular, color: MUTED });
  page.drawText(brand.tagline, { x: M, y: 32, size: 11, font: display, color: GOLD });

  return Buffer.from(await pdf.save());

  function box(p: typeof page, x: number, top: number, w: number, label: string, rows: string[]) {
    p.drawRectangle({ x, y: top - 80, width: w, height: 92, borderColor: LINE, borderWidth: 1, color: rgb(1, 1, 1) });
    drawSpaced(p, label, x + 14, top - 8, bold, 8.5, GOLD, 1.4);
    let cursor = top - 28;
    rows.forEach((row, i) => {
      const font = i === 0 ? bold : regular;
      const size = i === 0 ? 11.5 : 10;
      p.drawText(fit(row, font, size, w - 28), { x: x + 14, y: cursor, size, font, color: i === 0 ? INK : MUTED });
      cursor -= i === 0 ? 17 : 14;
    });
  }
}
