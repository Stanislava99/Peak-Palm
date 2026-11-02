"use client";

import { useState, type FormEvent } from "react";
import type { PropertyId } from "@/lib/properties";

/** The ask-a-question form (used inside the "Meet your host" section). */
export function AskForm({ property, hostName }: { property: PropertyId; hostName: string }) {
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

  if (sent) {
    return (
      <div className="reserve-done ask-done">
        <strong>Question sent</strong>
        <p>
          {hostName} will reply to {email}.
        </p>
      </div>
    );
  }

  return (
    <form className="reserve-form ask-form" onSubmit={submit}>
      <div className="ask-row">
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
        </label>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
        </label>
      </div>
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
  );
}
