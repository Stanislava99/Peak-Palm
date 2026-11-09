"use client";

import { useState, type FormEvent } from "react";
import { REVIEW_TEXT_MAX, REVIEW_TEXT_MIN } from "@/lib/review-limits";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function ReviewForm({ token, initialRating, defaultName }: { token: string; initialRating: number; defaultName: string }) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState(defaultName);
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) return setError("Choose a star rating.");
    if (text.trim().length < REVIEW_TEXT_MIN) return setError(`Write at least ${REVIEW_TEXT_MIN} characters.`);
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, rating, name, text, consent, website }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) setError(data.error ?? "The review couldn’t be sent.");
      else setDone(true);
    } catch {
      setError("The review couldn’t be sent. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="reserve-done review-done">
        <strong>Thank you!</strong>
        <p>Your review has been sent. It will appear on the website after a quick check by the host.</p>
      </div>
    );
  }

  const shown = hover || rating;
  return (
    <form className="reserve-form review-form" onSubmit={submit}>
      <fieldset className="review-rate">
        <legend>Your rating</legend>
        <div className="review-rate-stars" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={n <= shown ? "is-on" : ""}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              aria-pressed={rating === n}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
            >
              ★
            </button>
          ))}
          <span className="review-rate-label">{LABELS[shown] ?? ""}</span>
        </div>
      </fieldset>
      <label>
        Your review
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={REVIEW_TEXT_MAX}
          required
          placeholder="What did you enjoy? Anything future guests should know?"
        />
        <small className="review-chars">
          {text.length} / {REVIEW_TEXT_MAX}
        </small>
      </label>
      <label>
        Name shown with the review
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required autoComplete="given-name" />
      </label>
      <label className="hp-field" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </label>
      <label className="checkout-accept">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
        <span>I agree that my review, the name above and the month of my stay may be published on this website.</span>
      </label>
      {error ? <p className="reserve-error">{error}</p> : null}
      <button className="book-button reserve" type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send my review"}
      </button>
    </form>
  );
}
