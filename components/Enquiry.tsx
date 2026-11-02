"use client";

import { useState, type FormEvent } from "react";
import type { PropertyId } from "@/lib/properties";

export function Enquiry({ property, house }: { property: PropertyId; house: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property, name, email, message }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "The question could not be sent.");
        return;
      }
      setSent(true);
    } catch {
      setError("The question could not be sent. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="ask" className="section ask">
      <div className="section-head">
        <p className="eyebrow">Before you decide</p>
        <h2>Ask about {house}</h2>
        <p>The host reads these and replies by email. A question does not hold any dates.</p>
      </div>
      {sent ? (
        <div className="reserve-done ask-done">
          <strong>Question sent</strong>
          <p>Frosina will reply to {email}.</p>
        </div>
      ) : (
        <form className="reserve-form ask-form" onSubmit={submit}>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </label>
          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Question
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              placeholder="Arrival time, extra beds, how the house works…"
            />
          </label>
          {error ? <p className="reserve-error">{error}</p> : null}
          <button className="book-button reserve" type="submit" disabled={sending}>
            {sending ? "Sending…" : "Send the question"}
          </button>
        </form>
      )}
    </section>
  );
}
