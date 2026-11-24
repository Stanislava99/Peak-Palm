import { BALANCE_WHEN, CANCEL_HOURS, HOST_REPLY, HOUSE_RULES, cancellationRefund } from "./booking-config";
import { canStillCancel, cancelDeadline, cancelUrl, formatDeadline } from "./cancellation";
import type { Booking } from "./bookings";
import { brand } from "./brand";
import { formatMoney } from "./pricing";
import { contactEmail, isTestSite } from "./site-config";
import { getSiteUrl } from "./site";
import { formatLong, nightsBetween } from "./stay";
import { priceLines } from "./rentals";
import type { RentalReservation } from "./pdf/rental";

export const HOUSE_NAMES = { kaja: "Villa Kaja", janis: "Jani’s Beach House" } as const;
const HOUSE_PLACES = { kaja: "18 Sveti Ivan Rilski Street, Bansko, Bulgaria", janis: "Neoi Epivates, Thermaikos, Greece" } as const;

/** Escape anything a guest typed before it goes into HTML. */
export function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type Row = [string, string];

function rows(items: Row[]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0;border:1px solid #e3dccf;border-radius:12px">
${items
  .map(
    ([k, v], i) =>
      `<tr><td style="padding:10px 14px;color:#5d6b78;font-size:13px;${i ? "border-top:1px solid #eee7da;" : ""}width:38%">${esc(k)}</td><td style="padding:10px 14px;color:#10263a;font-size:14px;${i ? "border-top:1px solid #eee7da;" : ""}">${v}</td></tr>`,
  )
  .join("\n")}
</table>`;
}

function button(href: string, label: string) {
  return `<p style="margin:22px 0"><a href="${esc(href)}" style="display:inline-block;background:#123b5a;color:#f7f3ea;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:600;font-size:15px">${esc(label)}</a></p>`;
}

function layout(title: string, body: string) {
  const site = getSiteUrl();
  const test = isTestSite()
    ? `<div style="background:#b4412f;color:#fff;text-align:center;font-size:12px;padding:6px;letter-spacing:.08em">TEST SITE: no real payments</div>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f7f3ea;font-family:Helvetica,Arial,sans-serif;color:#10263a">
${test}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ea;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fdfbf6;border-radius:18px;overflow:hidden;border:1px solid #e3dccf">
<tr><td style="background:#123b5a;padding:22px 28px;text-align:center">
  <img src="${esc(site)}/brand/logo-light-email.png" width="220" alt="Sea &amp; Ski Villas" style="display:inline-block;border:0;max-width:220px">
</td></tr>
<tr><td style="padding:28px">
  <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;color:#123b5a">${esc(title)}</h1>
  ${body}
</td></tr>
<tr><td style="padding:18px 28px;background:#f1eadd;color:#5d6b78;font-size:12px;line-height:1.5">
  ${esc(brand.name)} · ${esc(brand.tagline)}<br>
  Questions? Reply to this email or write to <a href="mailto:${esc(contactEmail())}" style="color:#123b5a">${esc(contactEmail())}</a>.
</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${html}</p>`;

function stayRows(b: Booking): Row[] {
  const nights = nightsBetween(b.checkIn, b.checkOut);
  return [
    ["House", esc(HOUSE_NAMES[b.property])],
    ["Check-in", esc(formatLong(b.checkIn))],
    ["Check-out", esc(formatLong(b.checkOut))],
    ["Stay", `${nights} night${nights === 1 ? "" : "s"} · ${b.guests} guest${b.guests === 1 ? "" : "s"}`],
    ["Reference", `<b>${esc(b.ref)}</b>`],
  ];
}

function moneyRows(b: Booking, state: "held" | "deposit-paid" | "paid"): Row[] {
  return [
    ["Direct price", `<b>${formatMoney(b.directTotal)}</b>${b.airbnbTotal ? ` <span style="color:#5d6b78">(booking platforms: <s>${formatMoney(b.airbnbTotal)}</s>)</span>` : ""}`],
    ["Deposit", `${formatMoney(b.deposit)} · ${state === "held" ? "held on card, not charged yet" : "paid"}`],
    ["Balance", `${formatMoney(b.balance)} · ${state === "paid" ? "paid on arrival" : BALANCE_WHEN}`],
  ];
}

const textStay = (b: Booking) =>
  `${HOUSE_NAMES[b.property]}\n${formatLong(b.checkIn)} → ${formatLong(b.checkOut)}, ${b.guests} guests\nReference: ${b.ref}\nDirect price: ${formatMoney(b.directTotal)} (deposit ${formatMoney(b.deposit)}, balance ${formatMoney(b.balance)} ${BALANCE_WHEN})`;

/* ── Admin emails ── */

export function adminNewRequest(b: Booking) {
  const admin = `${getSiteUrl()}/admin`;
  return {
    subject: `New booking, please confirm · ${HOUSE_NAMES[b.property]} · ${formatLong(b.checkIn)} · ${b.ref}`,
    html: layout(
      "New booking request",
      p(`<b>${esc(b.name)}</b> has booked ${esc(HOUSE_NAMES[b.property])} and <b>paid the ${formatMoney(b.deposit)} deposit</b>.`) +
        p(`<b>Please confirm or decline on the admin page ${esc(HOST_REPLY)}.</b> The guest has been told the deposit is received and the booking awaits your confirmation. They get the confirmation (with the PDF) when you confirm; declining refunds the deposit in full.`) +
        rows([
          ...stayRows(b),
          ["Guest", esc(b.name)],
          ["Email", `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>`],
          ["Phone", `<a href="tel:${esc(b.phone)}">${esc(b.phone)}</a>`],
          ["Arrival", esc(b.arrival || "Not given")],
          ...(b.note ? ([["Message", esc(b.note)]] as Row[]) : []),
          ...moneyRows(b, "deposit-paid"),
        ]) +
        button(admin, "Confirm on the admin page"),
    ),
    text: `New booking from ${b.name} (${b.email}, ${b.phone}), deposit ${formatMoney(b.deposit)} paid.\n${textStay(b)}\nArrival: ${b.arrival}\nMessage: ${b.note}\n\nConfirm or decline: ${admin}`,
  };
}

export function adminEvent(b: Booking, what: string) {
  return {
    subject: `${what} · ${HOUSE_NAMES[b.property]} · ${b.ref}`,
    html: layout(what, rows([...stayRows(b), ["Guest", `${esc(b.name)} · ${esc(b.email)}`], ...moneyRows(b, b.balancePaid ? "paid" : "deposit-paid")]) + button(`${getSiteUrl()}/admin`, "Open the admin page")),
    text: `${what}\n${textStay(b)}\nGuest: ${b.name} ${b.email}`,
  };
}

export function adminLoginLink(url: string) {
  return {
    subject: "Your sign-in link for the Sea & Ski admin page",
    html: layout(
      "Sign in to the admin page",
      p("Use this button within 15 minutes. If you didn’t ask for it, ignore this email: nobody can sign in without it.") +
        button(url, "Sign in"),
    ),
    text: `Sign in to the Sea & Ski admin page (valid 15 minutes):\n${url}\n\nIf you didn't ask for this, ignore it.`,
  };
}

export function adminMessage(kind: "question" | "request", data: Record<string, string>) {
  const title = kind === "question" ? "New question from the website" : "New booking request (no online payment)";
  return {
    subject: `${title} · ${data.house ?? ""} · ${data.name ?? ""}`,
    html: layout(title, rows(Object.entries(data).map(([k, v]) => [k, esc(v)]))),
    text: `${title}\n${Object.entries(data).map(([k, v]) => `${k}: ${v}`).join("\n")}`,
  };
}

/* ── Guest emails ── */

export function guestRequestReceived(b: Booking) {
  return {
    subject: `We’ve received your request · ${HOUSE_NAMES[b.property]} · ${b.ref}`,
    html: layout(
      `Thank you, ${b.name.split(" ")[0]}`,
      p(`Your stay at ${esc(HOUSE_NAMES[b.property])} is reserved for you while ${esc(brand.host)} confirms it, ${esc(HOST_REPLY)}.`) +
        p(`We’ve <b>held ${formatMoney(b.deposit)}</b> on your card. It is only charged once the host confirms. If not, the hold is released automatically.`) +
        rows([...stayRows(b), ...moneyRows(b, "held")]),
    ),
    text: `Thank you! We've received your request.\n${textStay(b)}\n\n${formatMoney(b.deposit)} is held on your card and only charged once the host confirms (${HOST_REPLY}).`,
  };
}

/** Sent as soon as the deposit is paid, while the host reviews the booking. */
/** "Changed your plans?" with the personal cancel link, only while the free-cancellation window is open. */
function cancelBlock(b: Booking) {
  if (!canStillCancel(b)) return { html: "", text: "" };
  const until = formatDeadline(cancelDeadline(b));
  const { fee, refund } = cancellationRefund(b.deposit);
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 14px"><tr><td style="border:1px solid #e3dccf;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.55;color:#10263a">
<b>Changed your plans?</b><br>
You can cancel within ${CANCEL_HOURS} hours of booking, until <b>${esc(until)}</b>. You then get your deposit back minus the card payment fee Stripe charged on it (about ${formatMoney(fee)} for a European card, so roughly <b>${formatMoney(refund)}</b>; the exact amount is shown before you confirm). After that, cancellations are non-refundable.
<p style="margin:12px 0 0"><a href="${esc(cancelUrl(b))}" style="color:#123b5a;font-weight:600">Cancel my booking</a></p>
</td></tr></table>`,
    text: `\nChanged your plans? You can cancel until ${until} and get your deposit back minus Stripe's card fee (roughly ${formatMoney(refund)}; the exact amount is shown before you confirm): ${cancelUrl(b)}\nAfter that, cancellations are non-refundable.`,
  };
}

export function guestDepositReceived(b: Booking) {
  const cancel = cancelBlock(b);
  const first = b.name.split(" ")[0];
  return {
    subject: `Deposit received, awaiting confirmation · ${HOUSE_NAMES[b.property]} · ${b.ref}`,
    html: layout(
      `Thank you, ${first}`,
      p(`We’ve received your deposit of <b>${formatMoney(b.deposit)}</b>. Your dates at ${esc(HOUSE_NAMES[b.property])} are now <b>reserved for you</b> while ${esc(brand.host)} confirms the booking, ${esc(HOST_REPLY)}.`) +
        rows([...stayRows(b), ...moneyRows(b, "deposit-paid")]) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr><td style="background:#f1eadd;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.55;color:#10263a">
<b>What happens next</b><br>
1. ${esc(brand.host)} checks the dates and confirms ${esc(HOST_REPLY)}.<br>
2. You receive your booking confirmation by email, with a PDF and the arrival details.<br>
3. If the booking can’t be confirmed, your deposit is <b>refunded in full</b> to your card automatically, and we’ll email you.
</td></tr></table>` +
        p(`The remaining <b>${formatMoney(b.balance)}</b> is paid ${BALANCE_WHEN}. Questions in the meantime? Just reply to this email.`) +
        cancel.html,
    ),
    text: `Thank you! We've received your deposit of ${formatMoney(b.deposit)}.
${textStay(b)}

Your dates are reserved while ${brand.host} confirms the booking (${HOST_REPLY}). You'll receive the confirmation with a PDF and arrival details by email. If it can't be confirmed, the deposit is refunded in full automatically.
The remaining ${formatMoney(b.balance)} is paid ${BALANCE_WHEN}.${cancel.text}`,
  };
}

export function guestConfirmed(b: Booking) {
  const cancel = cancelBlock(b);
  const rules = HOUSE_RULES[b.property].map((r) => `<li style="margin:0 0 6px">${esc(r)}</li>`).join("");
  return {
    subject: `Booking confirmed · ${HOUSE_NAMES[b.property]} · ${formatLong(b.checkIn)}`,
    html: layout(
      "Your booking is confirmed",
      p(`Great news, ${esc(b.name.split(" ")[0])}! ${esc(brand.host)} has confirmed your stay. Your deposit of <b>${formatMoney(b.deposit)}</b> is already paid.`) +
        rows([...stayRows(b), ["Address", esc(HOUSE_PLACES[b.property])], ...moneyRows(b, "deposit-paid")]) +
        p(`The remaining <b>${formatMoney(b.balance)}</b> is paid <b>${BALANCE_WHEN}</b>. Please have it ready in euros when you arrive. Your booking confirmation is attached as a PDF.`) +
        `<p style="margin:16px 0 6px;font-weight:600">House rules</p><ul style="margin:0 0 12px;padding-left:18px;font-size:14px;line-height:1.5">${rules}</ul>` +
        cancel.html,
    ),
    text: `Your booking is confirmed!\n${textStay(b)}\nAddress: ${HOUSE_PLACES[b.property]}\nThe remaining ${formatMoney(b.balance)} is paid ${BALANCE_WHEN}. Confirmation PDF attached.${cancel.text}`,
  };
}

export function guestBalancePaid(b: Booking) {
  return {
    subject: `Paid in full · ${HOUSE_NAMES[b.property]} · ${b.ref}`,
    html: layout(
      "You’re all paid up",
      p(`Thank you, ${esc(b.name.split(" ")[0])}. We’ve received the balance of <b>${formatMoney(b.balance)}</b>. Your stay is fully paid. An updated confirmation is attached.`) +
        rows([...stayRows(b), ...moneyRows(b, "paid")]),
    ),
    text: `Thank you! Your stay is fully paid.\n${textStay(b)}\nUpdated confirmation attached.`,
  };
}

/** The guest cancelled with their link, in time: the deposit is refunded. */
export function guestCancelledRefunded(b: Booking, refunded?: number) {
  const first = b.name.split(" ")[0];
  const estimate = cancellationRefund(b.deposit);
  const refund = refunded ?? estimate.refund;
  const fee = Math.round((b.deposit - refund) * 100) / 100;
  return {
    subject: `Booking cancelled, deposit refunded · ${HOUSE_NAMES[b.property]} · ${b.ref}`,
    html: layout(
      "Your booking is cancelled",
      p(`Hello ${esc(first)}, as you asked, we’ve cancelled your stay at ${esc(HOUSE_NAMES[b.property])}. We’ve refunded <b>${formatMoney(refund)}</b> to your card: your deposit of ${formatMoney(b.deposit)} minus the ${formatMoney(fee)} card payment fee charged by Stripe. It usually shows on your statement within 5 to 10 working days.`) +
        rows(stayRows(b)) +
        p(`We’d love to welcome you another time.`) +
        button(`${getSiteUrl()}/${b.property === "kaja" ? "villa-kaja" : "janis"}#stay`, "See other dates"),
    ),
    text: `Your booking ${b.ref} is cancelled. We have refunded ${formatMoney(refund)} to your card (your deposit of ${formatMoney(b.deposit)} minus the ${formatMoney(fee)} Stripe card fee); it usually shows within 5 to 10 working days.\n${textStay(b)}`,
  };
}

export function guestDeclinedRefunded(b: Booking) {
  return {
    subject: `About your booking · ${HOUSE_NAMES[b.property]} · ${b.ref}`,
    html: layout(
      "We’re sorry: these dates aren’t available",
      p(`Dear ${esc(b.name.split(" ")[0])}, unfortunately ${esc(HOUSE_NAMES[b.property])} can’t be confirmed for these dates.`) +
        p(`Your deposit of <b>${formatMoney(b.deposit)}</b> has been <b>refunded in full</b> to the card you paid with. Depending on your bank it shows up within 5–10 days.`) +
        rows(stayRows(b)) +
        button(`${getSiteUrl()}/${b.property === "kaja" ? "villa-kaja" : "janis"}#stay`, "See other dates"),
    ),
    text: `We're sorry: ${HOUSE_NAMES[b.property]} can't be confirmed for these dates (${b.ref}). Your deposit of ${formatMoney(b.deposit)} has been refunded in full.`,
  };
}

export function guestNotConfirmed(b: Booking, expired: boolean) {
  return {
    subject: `About your request · ${HOUSE_NAMES[b.property]} · ${b.ref}`,
    html: layout(
      "We couldn’t confirm these dates",
      p(
        expired
          ? `We’re sorry, ${esc(b.name.split(" ")[0])}: your request for ${esc(HOUSE_NAMES[b.property])} wasn’t confirmed in time.`
          : `We’re sorry, ${esc(b.name.split(" ")[0])}: ${esc(HOUSE_NAMES[b.property])} isn’t available for these dates after all.`,
      ) +
        p(`The hold of <b>${formatMoney(b.deposit)}</b> on your card has been released. Nothing was charged. Depending on your bank it can take a few days to disappear from your statement.`) +
        rows(stayRows(b)) +
        button(`${getSiteUrl()}/${b.property === "kaja" ? "villa-kaja" : "janis"}#stay`, "See other dates"),
    ),
    text: `We couldn't confirm your request (${b.ref}). The hold of ${formatMoney(b.deposit)} has been released; nothing was charged.`,
  };
}

export function guestRequestAck(data: { name: string; house: string; checkIn: string; checkOut: string; guests: number; ref: string }) {
  return {
    subject: `We’ve received your booking request · ${data.house} · ${data.ref}`,
    html: layout(
      `Thank you, ${data.name.split(" ")[0]}`,
      p(`${esc(brand.host)} will email you ${esc(HOST_REPLY)} to confirm the dates and send a secure payment link. Nothing is booked or charged yet.`) +
        rows([
          ["House", esc(data.house)],
          ["Check-in", esc(formatLong(data.checkIn))],
          ["Check-out", esc(formatLong(data.checkOut))],
          ["Guests", String(data.guests)],
          ["Reference", `<b>${esc(data.ref)}</b>`],
        ]),
    ),
    text: `Thanks! We've received your booking request ${data.ref} for ${data.house}, ${data.checkIn} → ${data.checkOut}. The host will email you to confirm and send a payment link.`,
  };
}

/* ── Reviews from direct guests ── */

export function guestReviewRequest(b: Booking, link: string) {
  const first = b.name.split(" ")[0];
  const stars = [5, 4, 3, 2, 1]
    .map(
      (n) =>
        `<a href="${esc(`${link}&r=${n}`)}" style="display:inline-block;margin:0 3px;padding:8px 10px;border-radius:10px;background:#f1eadd;color:#c8a46d;text-decoration:none;font-size:20px;line-height:1" title="${n} star${n === 1 ? "" : "s"}">${"★".repeat(n)}</a>`,
    )
    .join("<br>");
  return {
    subject: `How was your stay at ${HOUSE_NAMES[b.property]}?`,
    html: layout(
      `Thank you for staying with us, ${esc(first)}`,
      p(`We hope you had a wonderful time at ${esc(HOUSE_NAMES[b.property])}. Would you share a few words about your stay? It takes a minute and helps other guests who book with us directly.`) +
        `<p style="margin:18px 0 6px;font-size:14px;color:#5d6b78">Tap a rating to start:</p><p style="margin:0 0 18px;line-height:2.2">${stars}</p>` +
        button(link, "Write a review") +
        p(`<span style="color:#5d6b78;font-size:13px">Your review appears on our website with your first name and the month of your stay. This personal link works for 120 days.</span>`),
    ),
    text: `Thank you for staying at ${HOUSE_NAMES[b.property]}, ${first}! Would you share a few words about your stay? ${link}\n\nYour review appears on our website with your first name and the month of your stay.`,
  };
}

export function adminNewReview(b: Booking, review: { name: string; rating: number; text: string }) {
  return {
    subject: `New guest review (${review.rating}★) · ${HOUSE_NAMES[b.property]} · ${b.ref}`,
    html: layout(
      "A guest left a review",
      p(`<b>${esc(review.name)}</b> reviewed their stay at ${esc(HOUSE_NAMES[b.property])}. It isn’t on the website yet: publish it on the admin page.`) +
        rows([
          ["Rating", `<span style="color:#c8a46d">${"★".repeat(review.rating)}</span>${"☆".repeat(5 - review.rating)}`],
          ["Review", esc(review.text).replace(/\n/g, "<br>")],
          ...stayRows(b),
        ]) +
        button(`${getSiteUrl()}/admin#reviews`, "Publish on the admin page"),
    ),
    text: `New ${review.rating}-star review from ${review.name} (${HOUSE_NAMES[b.property]}, ${b.ref}):\n\n${review.text}\n\nPublish it: ${getSiteUrl()}/admin#reviews`,
  };
}

/* ── Ski equipment & ski school reservations (no payment; Frosina passes them to the shop) ── */

function rentalRows(r: RentalReservation): Row[] {
  const { lines, total, someOnRequest } = priceLines(r.lines);
  return [
    ...lines.map(
      (l): Row => [
        `${formatLong(l.from)}`,
        `<b>${esc(l.title)}</b><br><span style="color:#5d6b78">${esc(l.detail)}</span> · ${l.price === null ? "price on request" : l.price === 0 ? "free" : formatMoney(l.price)}`,
      ],
    ),
    ["Estimated total", `<b>${formatMoney(total)}</b>${someOnRequest ? " + lessons on request" : ""} · paid at the shop, nothing paid online`],
  ];
}

const rentalText = (r: RentalReservation) => {
  const { lines, total } = priceLines(r.lines);
  return `${lines.map((l) => `- ${formatLong(l.from)}: ${l.title}, ${l.detail}, ${l.price === null ? "price on request" : formatMoney(l.price)}`).join("\n")}\nEstimated total: ${formatMoney(total)} (paid at the shop)`;
};

export function adminRental(r: RentalReservation) {
  const title = "Ski equipment / ski school reservation";
  return {
    subject: `${title} · ${r.name} · ${r.checkIn ? formatLong(r.checkIn) : "Villa Kaja"} · ${r.ref}`,
    html: layout(
      title,
      p(`<b>${esc(r.name)}</b> wants to reserve ski equipment or ski school in Bansko. Nothing has been paid; the PDF is attached for the shop.`) +
        rows([
          ["Guest", esc(r.name)],
          ["Email", `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`],
          ["Phone", `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>`],
          ...(r.checkIn && r.checkOut ? ([["Stay", `${esc(formatLong(r.checkIn))} – ${esc(formatLong(r.checkOut))}${r.guests ? ` · ${r.guests} guests` : ""}`]] as Row[]) : []),
          ...(r.bookedVia ? ([["Booked via", esc(r.bookedVia) + (r.bookingRef ? ` · ${esc(r.bookingRef)}` : "")]] as Row[]) : []),
          ["Reference", `<b>${esc(r.ref)}</b>`],
          ...(r.note ? ([["Note", esc(r.note)]] as Row[]) : []),
        ]) +
        rows(rentalRows(r)),
    ),
    text: `${title} ${r.ref}\n${r.name} · ${r.email} · ${r.phone}\nStay: ${r.checkIn ?? "?"} → ${r.checkOut ?? "?"}${r.bookedVia ? ` (booked via ${r.bookedVia}${r.bookingRef ? `, ${r.bookingRef}` : ""})` : ""}\n${rentalText(r)}${r.note ? `\nNote: ${r.note}` : ""}`,
  };
}

export function guestRentalAck(r: RentalReservation) {
  return {
    subject: `Your ski equipment / ski school reservation · ${r.ref}`,
    html: layout(
      `Thank you, ${r.name.split(" ")[0]}`,
      p(`We’ve sent your reservation to ${esc(brand.host)}, who passes it to our partner shop in Bansko and gets back to you about sizes and pick-up. Nothing is paid now: you pay the shop or ski school in Bansko. Your reservation is attached as a PDF.`) +
        rows(rentalRows(r)),
    ),
    text: `Thanks! ${brand.host} has your ski equipment / ski school reservation ${r.ref} and will pass it to the shop. Nothing is paid now.\n${rentalText(r)}`,
  };
}
