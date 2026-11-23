"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { DEPOSIT_LABEL, OFFERS_LINE } from "@/lib/booking-config";
import { SecurePay } from "./SecurePay";
import { formatMoney } from "@/lib/pricing";
import type { PropertyId } from "@/lib/properties";
import { track, trackFunnel } from "@/lib/track";

const ARRIVAL_TIMES = ["Not sure yet", "Before 4 pm", "4–6 pm", "6–8 pm", "8–10 pm", "After 10 pm"];

/** Which form field an element is, for "form left" analytics (the field's name only, never its value). */
function fieldOf(el: EventTarget | null): string | null {
  if (!(el instanceof HTMLElement)) return null;
  if (el instanceof HTMLTextAreaElement) return "message";
  if (el instanceof HTMLSelectElement) return "arrival";
  if (!(el instanceof HTMLInputElement)) return null;
  if (el.type === "checkbox") return el.closest(".is-optional") ? "offers" : "rules";
  if (el.autocomplete === "name") return "name";
  if (el.type === "email") return "email";
  if (el.type === "tel") return "phone";
  return null;
}

/** Short reason for a failed /api/checkout call, by status (see app/api/checkout/route.ts). */
function checkoutErrorReason(status: number): string {
  if (status === 400) return "details rejected";
  if (status === 409) return "dates just taken";
  if (status === 429 || status === 403) return "blocked or too many tries";
  if (status === 503) return "price or bookings unavailable";
  if (status === 502) return "stripe error";
  return `error ${status}`;
}

export function CheckoutForm({
  property,
  checkIn,
  checkOut,
  guests,
  deposit,
  total,
  paymentsOn,
  houseName,
  cancelled = false,
}: {
  property: PropertyId;
  checkIn: string;
  checkOut: string;
  guests: number;
  deposit: number;
  /** Direct price for the whole stay (analytics price band only). */
  total?: number;
  paymentsOn: boolean;
  houseName: string;
  /** The guest came back from Stripe without paying (cancel_url adds cancelled=1). */
  cancelled?: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [arrival, setArrival] = useState(ARRIVAL_TIMES[0]);
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestRef, setRequestRef] = useState<string | null>(null);
  const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    track("Checkout started", { house: property, nights, guests, deposit: Math.round(deposit) });
  }, [property, nights, guests, deposit]);

  // Booking funnel (Umami + Vercel): back from Stripe without paying, form filled, form left.
  const stay = { house: property, checkIn, checkOut, guests, total };
  useEffect(() => {
    if (!cancelled) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("cancelled"); // a reload must not count it again
    window.history.replaceState(window.history.state, "", url);
    trackFunnel("Booking 6: payment cancelled", stay, { stripe: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelled]);
  const done = {
    name: name.trim().length >= 2,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    phone: phone.replace(/\D/g, "").length >= 6,
    rules: accepted,
  };
  const fieldsDone = Object.values(done).filter(Boolean).length;
  const formComplete = fieldsDone === 4;
  const filled = useRef(false);
  const startedAt = useRef(Date.now());
  useEffect(() => {
    if (!formComplete || filled.current) return;
    filled.current = true;
    trackFunnel("Booking 3: form filled", stay, { data: { seconds: Math.round((Date.now() - startedAt.current) / 1000) } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formComplete]);
  // Closing or leaving the checkout without sending: which field they were on and how far they got.
  const lastField = useRef("none");
  const submitted = useRef(false);
  const leaveInfo = useRef({ fieldsDone: 0 });
  leaveInfo.current = { fieldsDone };
  useEffect(() => {
    function onLeave() {
      if (submitted.current) return;
      submitted.current = true; // once per visit
      trackFunnel("Booking 3: form left", stay, {
        vercel: false,
        data: {
          lastField: lastField.current,
          fieldsDone: leaveInfo.current.fieldsDone,
          seconds: Math.round((Date.now() - startedAt.current) / 1000),
        },
      });
    }
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    track("Pay deposit clicked", { house: property, nights, guests, deposit: Math.round(deposit), online: paymentsOn });
    submitted.current = true;
    trackFunnel("Booking 4: form submitted", stay, {
      data: { offers: marketing, message: note.trim().length > 0, arrivalSet: arrival !== ARRIVAL_TIMES[0] },
    });
    try {
      if (paymentsOn) {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ property, checkIn, checkOut, guests, name, email, phone, arrival, note, accepted, marketing, website }),
        });
        const data = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !data.url) {
          track("Checkout error", { house: property, status: response.status });
          trackFunnel("Booking 4: payment page error", stay, { data: { reason: checkoutErrorReason(response.status), status: response.status } });
          setError(data.error ?? "The payment page could not be opened.");
          setSending(false);
          return;
        }
        // The server sends this step to Vercel; Umami needs it from the browser to keep it in the
        // guest's visit (its funnel report follows one visitor). Umami sends with keepalive, and the
        // short pause gives it a head start before the page changes.
        trackFunnel("Booking 5: payment started", stay, { vercel: false, stripe: "start", data: { deposit: Math.round(deposit) } });
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        window.location.assign(data.url);
        return;
      }
      // Online payment not switched on yet: send it as a request instead.
      const response = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property,
          checkIn,
          checkOut,
          guests,
          name,
          email,
          phone,
          note: [arrival !== ARRIVAL_TIMES[0] ? `Arrival: ${arrival}` : "", note].filter(Boolean).join(" · "),
        }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        setError(data.error ?? "The request could not be sent.");
      } else {
        track("Booking request sent", { house: property, nights, guests });
        trackFunnel("Booking 5: request sent", stay);
        setRequestRef(data.id);
      }
    } catch {
      trackFunnel("Booking 4: payment page error", stay, { data: { reason: "network or page error" } });
      setError("Something went wrong. Please try again.");
    }
    setSending(false);
  }

  if (requestRef) {
    return (
      <div className="checkout-card checkout-done">
        <h2>Request sent</h2>
        <p>
          The host will email you to confirm {houseName} and how to pay. Your reference is <b>{requestRef}</b>.
        </p>
      </div>
    );
  }

  return (
    <form
      className="checkout-card checkout-form"
      onSubmit={submit}
      onFocusCapture={(event) => {
        const field = fieldOf(event.target);
        if (field) lastField.current = field;
      }}
    >
      {!paymentsOn ? (
        <div className="checkout-notice" role="note">
          <b>How payment works right now</b>
          <span>
            Online card payment isn’t switched on yet. Send your booking details below; the host checks the dates and
            emails you a secure payment link {`within 48 hours`}. Your dates are confirmed once you pay.
          </span>
        </div>
      ) : null}
      <h2>Lead guest</h2>
      <div className="details-grid">
        <label>
          <span>Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={120} />
        </label>
        <label>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required maxLength={160} />
        </label>
        <label>
          <span>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" required maxLength={40} placeholder="+359 …" />
        </label>
        <label>
          <span>Arrival time</span>
          <select value={arrival} onChange={(e) => setArrival(e.target.value)}>
            {ARRIVAL_TIMES.map((time) => (
              <option key={time}>{time}</option>
            ))}
          </select>
        </label>
        <label className="wide">
          <span>
            Message to the host <small>optional</small>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={480}
            placeholder="Who’s coming, ages of children, anything that helps the host prepare"
          />
        </label>
      </div>

      <label className="hp-field" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>

      <label className="checkout-accept">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>
          I accept the house rules and the cancellation policy below, and I’ve read the{" "}
          <a href="/privacy" target="_blank" rel="noreferrer">
            privacy notice
          </a>
          .
        </span>
      </label>

      {paymentsOn ? (
        <label className="checkout-accept is-optional">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
          <span>
            {OFFERS_LINE} <small>Optional.</small>
          </span>
        </label>
      ) : null}

      {error ? <p className="reserve-error">{error}</p> : null}

      <button className="book-button reserve checkout-pay" type="submit" disabled={sending || !accepted} title={accepted ? undefined : "Tick the box above to continue"}>
        {sending
          ? paymentsOn
            ? "Opening secure payment…"
            : "Sending…"
          : paymentsOn
            ? `Pay deposit · ${formatMoney(deposit)}`
            : "Request to book · pay after the host confirms"}
      </button>
      <p className="checkout-fine">
        {paymentsOn
          ? `You’ll pay on Stripe’s secure page. Only the ${DEPOSIT_LABEL} deposit is paid today; your confirmation follows by email once the host confirms.`
          : "Nothing is charged now. You’ll receive a secure payment link by email once the host confirms your dates."}
      </p>
      {paymentsOn ? <SecurePay /> : null}
    </form>
  );
}
