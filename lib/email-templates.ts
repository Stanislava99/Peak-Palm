import { HOST_REPLY, HOUSE_RULES } from "./booking-config";
import type { Booking } from "./bookings";
import { brand } from "./brand";
import { formatMoney } from "./pricing";
import { contactEmail, isTestSite } from "./site-config";
import { getSiteUrl } from "./site";
import { formatLong, nightsBetween } from "./stay";

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
      `<tr><td style="padding:10px 14px;color:#6b6f66;font-size:13px;${i ? "border-top:1px solid #eee7da;" : ""}width:38%">${esc(k)}</td><td style="padding:10px 14px;color:#1b2a24;font-size:14px;${i ? "border-top:1px solid #eee7da;" : ""}">${v}</td></tr>`,
  )
  .join("\n")}
</table>`;
}

function button(href: string, label: string) {
  return `<p style="margin:22px 0"><a href="${esc(href)}" style="display:inline-block;background:#1f3a30;color:#f3eee5;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:600;font-size:15px">${esc(label)}</a></p>`;
}

function layout(title: string, body: string) {
  const site = getSiteUrl();
  const test = isTestSite()
    ? `<div style="background:#b4412f;color:#fff;text-align:center;font-size:12px;padding:6px;letter-spacing:.08em">TEST SITE: no real payments</div>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f3eee5;font-family:Helvetica,Arial,sans-serif;color:#1b2a24">
${test}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3eee5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fbf9f5;border-radius:18px;overflow:hidden;border:1px solid #e3dccf">
<tr><td style="background:#1f3a30;padding:22px 28px;text-align:center">
  <img src="${esc(site)}/brand/logo-light-email.png" width="220" alt="Peak &amp; Palm Villas" style="display:inline-block;border:0;max-width:220px">
</td></tr>
<tr><td style="padding:28px">
  <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;color:#1f3a30">${esc(title)}</h1>
  ${body}
</td></tr>
<tr><td style="padding:18px 28px;background:#efe8db;color:#6b6f66;font-size:12px;line-height:1.5">
  ${esc(brand.name)} · ${esc(brand.tagline)}<br>
  Questions? Reply to this email or write to <a href="mailto:${esc(contactEmail())}" style="color:#1f3a30">${esc(contactEmail())}</a>.
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
    ["Direct price", `<b>${formatMoney(b.directTotal)}</b>${b.airbnbTotal ? ` <span style="color:#6b6f66">(Airbnb: <s>${formatMoney(b.airbnbTotal)}</s>)</span>` : ""}`],
    ["Deposit", `${formatMoney(b.deposit)} · ${state === "held" ? "held on card, not charged yet" : "paid"}`],
    ["Balance", `${formatMoney(b.balance)} · ${state === "paid" ? "paid" : "charged before arrival"}`],
  ];
}

const textStay = (b: Booking) =>
  `${HOUSE_NAMES[b.property]}\n${formatLong(b.checkIn)} → ${formatLong(b.checkOut)}, ${b.guests} guests\nReference: ${b.ref}\nDirect price: ${formatMoney(b.directTotal)} (deposit ${formatMoney(b.deposit)}, balance ${formatMoney(b.balance)})`;

/* ── Admin emails ── */

export function adminNewRequest(b: Booking) {
  const admin = `${getSiteUrl()}/admin`;
  return {
    subject: `New booking, please confirm · ${HOUSE_NAMES[b.property]} · ${formatLong(b.checkIn)} · ${b.ref}`,
    html: layout(
      "New booking request",
      p(`<b>${esc(b.name)}</b> has booked ${esc(HOUSE_NAMES[b.property])} and <b>paid the ${formatMoney(b.deposit)} deposit</b>.`) +
        p(`<b>Please confirm or decline on the admin page.</b> The guest gets their confirmation (with the PDF) only when you confirm. Declining refunds the deposit.`) +
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
    subject: "Your sign-in link for the Peak & Palm admin page",
    html: layout(
      "Sign in to the admin page",
      p("Use this button within 15 minutes. If you didn’t ask for it, ignore this email: nobody can sign in without it.") +
        button(url, "Sign in"),
    ),
    text: `Sign in to the Peak & Palm admin page (valid 15 minutes):\n${url}\n\nIf you didn't ask for this, ignore it.`,
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

export function guestConfirmed(b: Booking) {
  const rules = HOUSE_RULES[b.property].map((r) => `<li style="margin:0 0 6px">${esc(r)}</li>`).join("");
  return {
    subject: `Booking confirmed · ${HOUSE_NAMES[b.property]} · ${formatLong(b.checkIn)}`,
    html: layout(
      "Your booking is confirmed",
      p(`Great news, ${esc(b.name.split(" ")[0])}! ${esc(brand.host)} has confirmed your stay. Your deposit of <b>${formatMoney(b.deposit)}</b> has been charged.`) +
        rows([...stayRows(b), ["Address", esc(HOUSE_PLACES[b.property])], ...moneyRows(b, "deposit-paid")]) +
        p(`The remaining <b>${formatMoney(b.balance)}</b> will be charged to the same card before arrival. Your booking confirmation is attached as a PDF.`) +
        `<p style="margin:16px 0 6px;font-weight:600">House rules</p><ul style="margin:0 0 12px;padding-left:18px;font-size:14px;line-height:1.5">${rules}</ul>`,
    ),
    text: `Your booking is confirmed!\n${textStay(b)}\nAddress: ${HOUSE_PLACES[b.property]}\nThe balance of ${formatMoney(b.balance)} is charged before arrival. Confirmation PDF attached.`,
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
