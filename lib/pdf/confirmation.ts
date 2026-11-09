import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CANCELLATION_POLICY, HOUSE_RULES } from "../booking-config";
import type { Booking } from "../bookings";
import { brand } from "../brand";
import { formatMoney } from "../pricing";
import { businessDetails, isTestSite } from "../site-config";
import { formatLong, nightsBetween } from "../stay";
import { CORMORANT_600, LOGO_LIGHT_PNG, NOTO_400, NOTO_600 } from "./assets";

const PINE = rgb(0x12 / 255, 0x3b / 255, 0x5a / 255);
const GOLD = rgb(0xc8 / 255, 0xa4 / 255, 0x6d / 255);
const INK = rgb(0x10 / 255, 0x26 / 255, 0x3a / 255);
const MUTED = rgb(0x56 / 255, 0x64 / 255, 0x72 / 255);
const LINE = rgb(0xe3 / 255, 0xdc / 255, 0xcf / 255);
const SAND = rgb(0xf7 / 255, 0xf3 / 255, 0xea / 255);
const RED = rgb(0xb4 / 255, 0x41 / 255, 0x2f / 255);

const HOUSES = {
  kaja: { name: "Villa Kaja", address: "18 Sveti Ivan Rilski Street, 2770 Bansko, Bulgaria", times: "Check-in from 4:00 pm · Check-out by 11:00 am" },
  janis: { name: "Jani’s Beach House", address: "Neoi Epivates, Thermaikos, Greece", times: "Self check-in with a lockbox" },
} as const;

export type ConfirmationState = "deposit-paid" | "paid";

/** Branded A4 booking confirmation & payment receipt. */
export async function confirmationPdf(b: Booking, state: ConfirmationState, paidAt = new Date()): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Booking confirmation ${b.ref}`);
  pdf.setAuthor(brand.name);
  pdf.setCreator(brand.name);
  const regular = await pdf.embedFont(Buffer.from(NOTO_400, "base64"), { subset: true });
  const bold = await pdf.embedFont(Buffer.from(NOTO_600, "base64"), { subset: true });
  const display = await pdf.embedFont(Buffer.from(CORMORANT_600, "base64"), { subset: true });
  const logo = await pdf.embedPng(Buffer.from(LOGO_LIGHT_PNG, "base64"));

  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const M = 48;
  const biz = businessDetails();

  // Header band with logo
  page.drawRectangle({ x: 0, y: height - 118, width, height: 118, color: PINE });
  const logoW = 190;
  const logoH = (logo.height / logo.width) * logoW;
  page.drawImage(logo, { x: M, y: height - 59 - logoH / 2, width: logoW, height: logoH });
  rightText(page, "BOOKING CONFIRMATION", width - M, height - 50, bold, 9, GOLD, 1.6);
  rightText(page, "& PAYMENT RECEIPT", width - M, height - 64, bold, 9, GOLD, 1.6);
  rightText(page, b.ref, width - M, height - 86, display, 18, SAND);
  if (isTestSite()) {
    page.drawRectangle({ x: 0, y: height - 136, width, height: 18, color: RED });
    centerText(page, "TEST DOCUMENT · NOT A REAL BOOKING", width / 2, height - 130, bold, 8, rgb(1, 1, 1), 1.4);
  }

  let y = height - 168;
  // Title + status
  page.drawText(state === "paid" ? "Your stay is fully paid" : "Your stay is confirmed", { x: M, y, size: 26, font: display, color: PINE });
  y -= 22;
  page.drawText(`Issued ${formatLong(paidAt.toISOString().slice(0, 10))} · ${brand.name}`, { x: M, y, size: 9.5, font: regular, color: MUTED });

  // Two columns: guest / stay
  y -= 34;
  const colW = (width - M * 2 - 20) / 2;
  block(page, M, y, colW, "GUEST", [b.name, b.email, b.phone].filter(Boolean), regular, bold);
  block(page, M + colW + 20, y, colW, "STAY", [HOUSES[b.property].name, HOUSES[b.property].address], regular, bold);

  // Stay details table
  y -= 100;
  const nights = nightsBetween(b.checkIn, b.checkOut);
  y = table(page, M, y, width - M * 2, [
    ["Check-in", formatLong(b.checkIn)],
    ["Check-out", formatLong(b.checkOut)],
    ["Nights · guests", `${nights} night${nights === 1 ? "" : "s"} · ${b.guests} guest${b.guests === 1 ? "" : "s"}`],
    ["Arrival", b.arrival || "To be arranged"],
    ["Times", HOUSES[b.property].times],
  ], regular, bold);

  // Payment summary
  y -= 26;
  drawSpaced(page, "PAYMENT", M, y, bold, 8.5, GOLD, 1.4);
  y -= 14;
  const paid = state === "paid" ? b.directTotal : b.deposit;
  const due = b.directTotal - paid;
  y = table(page, M, y, width - M * 2, [
    [`Accommodation, ${nights} night${nights === 1 ? "" : "s"} (direct booking price)`, formatMoney(b.directTotal)],
    ...(b.airbnbTotal ? ([["Same dates on Airbnb (for comparison)", `${formatMoney(b.airbnbTotal)} · you save ${formatMoney(b.airbnbTotal - b.directTotal)}`]] as Array<[string, string]>) : []),
    ["Deposit (50%), paid by card", `– ${formatMoney(b.deposit)}`],
    ...(state === "paid" ? ([["Balance, paid in cash", `– ${formatMoney(b.balance)}`]] as Array<[string, string]>) : []),
  ], regular, bold, true);

  // Totals box
  y -= 10;
  page.drawRectangle({ x: M, y: y - 52, width: width - M * 2, height: 52, color: SAND, borderColor: LINE, borderWidth: 1 });
  page.drawText("Paid", { x: M + 16, y: y - 22, size: 10, font: regular, color: MUTED });
  page.drawText(formatMoney(paid), { x: M + 16, y: y - 42, size: 16, font: bold, color: PINE });
  rightText(page, due > 0 ? "Balance due in cash at check-in" : "Balance due", width - M - 16, y - 22, regular, 10, MUTED);
  rightText(page, formatMoney(due), width - M - 16, y - 42, bold, 16, due > 0 ? INK : PINE);
  y -= 70;

  // Policies
  drawSpaced(page, "CANCELLATION", M, y, bold, 8.5, GOLD, 1.4);
  drawSpaced(page, "HOUSE RULES", M + colW + 20, y, bold, 8.5, GOLD, 1.4);
  y -= 14;
  const left = bullets(page, M, y, colW, CANCELLATION_POLICY, regular);
  const right = bullets(page, M + colW + 20, y, colW, HOUSE_RULES[b.property], regular);
  y = Math.min(left, right);

  // Footer
  page.drawLine({ start: { x: M, y: 84 }, end: { x: width - M, y: 84 }, thickness: 0.8, color: LINE });
  const issuer = [biz.legalName || biz.tradingName, biz.address, biz.taxId ? `Tax/VAT no. ${biz.taxId}` : ""].filter(Boolean).join(" · ");
  page.drawText(issuer, { x: M, y: 70, size: 8.5, font: bold, color: INK });
  page.drawText(`Questions: ${biz.email} · Hosted by ${brand.host}`, { x: M, y: 57, size: 8.5, font: regular, color: MUTED });
  page.drawText(
    biz.legalName && biz.taxId
      ? "Card payments processed securely by Stripe."
      : "This document confirms your booking and the payments received. It is not a tax invoice. Card payments processed securely by Stripe.",
    { x: M, y: 44, size: 7.5, font: regular, color: MUTED, maxWidth: width - M * 2 },
  );
  page.drawText(brand.tagline, { x: M, y: 26, size: 11, font: display, color: GOLD });

  return Buffer.from(await pdf.save());
}

function drawSpaced(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = INK, spacing = 0) {
  if (!spacing) {
    page.drawText(text, { x, y, size, font, color });
    return;
  }
  let cursor = x;
  for (const char of text) {
    page.drawText(char, { x: cursor, y, size, font, color });
    cursor += font.widthOfTextAtSize(char, size) + spacing;
  }
}

function rightText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = INK, spacing = 0) {
  const w = font.widthOfTextAtSize(text, size) + spacing * Math.max(0, text.length - 1);
  drawSpaced(page, text, x - w, y, font, size, color, spacing);
}

function centerText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = INK, spacing = 0) {
  const w = font.widthOfTextAtSize(text, size) + spacing * Math.max(0, text.length - 1);
  drawSpaced(page, text, x - w / 2, y, font, size, color, spacing);
}

function fit(text: string, font: PDFFont, size: number, max: number) {
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(out, size) > max) out = out.slice(0, -2) + "…";
  return out;
}

function block(page: PDFPage, x: number, y: number, w: number, label: string, lines: string[], regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x, y: y - 80, width: w, height: 92, borderColor: LINE, borderWidth: 1, color: rgb(1, 1, 1) });
  drawSpaced(page, label, x + 14, y - 8, bold, 8.5, GOLD, 1.4);
  let cursor = y - 28;
  lines.forEach((line, i) => {
    const font = i === 0 ? bold : regular;
    const size = i === 0 ? 11.5 : 10;
    for (const part of wrap(line, font, size, w - 28).slice(0, 2)) {
      page.drawText(part, { x: x + 14, y: cursor, size, font, color: i === 0 ? INK : MUTED });
      cursor -= i === 0 ? 17 : 14;
    }
  });
}

function wrap(text: string, font: PDFFont, size: number, max: number) {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > max) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(fit(line, font, size, max));
  return out;
}

function table(page: PDFPage, x: number, y: number, w: number, items: Array<[string, string]>, regular: PDFFont, bold: PDFFont, rightAlign = false) {
  const rowH = 22;
  items.forEach(([k, v], i) => {
    const top = y - i * rowH;
    if (i) page.drawLine({ start: { x, y: top + 8 }, end: { x: x + w, y: top + 8 }, thickness: 0.6, color: LINE });
    page.drawText(fit(k, regular, 10, w * 0.6), { x, y: top - 8, size: 10, font: regular, color: MUTED });
    const value = fit(v, bold, 10, w * (rightAlign ? 0.4 : 0.6));
    if (rightAlign) rightText(page, value, x + w, top - 8, bold, 10, INK);
    else page.drawText(value, { x: x + w * 0.36, y: top - 8, size: 10, font: bold, color: INK });
  });
  return y - items.length * rowH;
}

function bullets(page: PDFPage, x: number, y: number, w: number, items: string[], font: PDFFont) {
  const size = 8.8;
  const lineH = 12.5;
  for (const item of items) {
    const words = item.split(" ");
    let line = "";
    let first = true;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > w - 12) {
        page.drawText(line, { x: x + 10, y, size, font, color: MUTED });
        if (first) page.drawCircle({ x: x + 3, y: y + 3, size: 1.6, color: GOLD });
        first = false;
        y -= lineH;
        line = word;
      } else line = next;
    }
    page.drawText(line, { x: x + 10, y, size, font, color: MUTED });
    if (first) page.drawCircle({ x: x + 3, y: y + 3, size: 1.6, color: GOLD });
    y -= lineH + 4;
  }
  return y;
}
