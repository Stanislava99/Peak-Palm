"use client";

import { useState, type FormEvent } from "react";
import { DEPOSIT_LABEL } from "@/lib/booking-config";
import { formatMoney } from "@/lib/pricing";
import type { PropertyId } from "@/lib/properties";

const ARRIVAL_TIMES = ["Not sure yet", "Before 4 pm", "4–6 pm", "6–8 pm", "8–10 pm", "After 10 pm"];

export function CheckoutForm({
  property,
  checkIn,
  checkOut,
  guests,
  deposit,
  paymentsOn,
  houseName,
}: {
  property: PropertyId;
  checkIn: string;
  checkOut: string;
  guests: number;
  deposit: number;
  paymentsOn: boolean;
  houseName: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [arrival, setArrival] = useState(ARRIVAL_TIMES[0]);
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestRef, setRequestRef] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      if (paymentsOn) {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ property, checkIn, checkOut, guests, name, email, phone, arrival, note, accepted, website }),
        });
        const data = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !data.url) {
          setError(data.error ?? "The payment page could not be opened.");
          setSending(false);
          return;
        }
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
        setRequestRef(data.id);
      }
    } catch {
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
    <form className="checkout-card checkout-form" onSubmit={submit}>
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
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required />
        <span>I accept the house rules and the cancellation policy below.</span>
      </label>

      {error ? <p className="reserve-error">{error}</p> : null}

      <button className="book-button reserve checkout-pay" type="submit" disabled={sending}>
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
    </form>
  );
}
