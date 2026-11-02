"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Review } from "@/lib/reviews";
import { Icon } from "./Icons";

const AUTOPLAY_MS = 7000;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * A stacked deck of review cards: the next two cards peek out behind the current one.
 * Auto-advances (paused on hover, focus, hidden tab, or reduced motion); swipe, arrows and keys work too.
 */
export function ReviewDeck({ reviews, airbnbUrl }: { reviews: Review[]; airbnbUrl: string }) {
  const count = reviews.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const [cycle, setCycle] = useState(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => (current + delta + count) % count);
      setCycle((c) => c + 1);
    },
    [count],
  );

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(motion.matches);
    update();
    motion.addEventListener("change", update);
    return () => motion.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || still || count < 2) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") go(1);
      else setCycle((c) => c + 1);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [paused, still, count, go, cycle]);

  if (!count) return null;

  const onPointerDown = (event: ReactPointerEvent) => {
    swipe.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(event.clientY - start.y)) go(dx < 0 ? 1 : -1);
  };

  const reviewsUrl = `${airbnbUrl.replace(/\/$/, "")}/reviews`;

  return (
    <div
      className={`review-deck${paused || still ? " is-paused" : ""}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Guest reviews from Airbnb"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(1);
        if (event.key === "ArrowLeft") go(-1);
      }}
    >
      <div className="review-deck-head">
        <p className="eyebrow">What guests say</p>
        <span className="review-count" aria-live="polite">
          <b>{String(index + 1).padStart(2, "0")}</b> / {String(count).padStart(2, "0")}
        </span>
      </div>

      <div className="review-stack" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)}>
        {reviews.map((review, i) => {
          const offset = (i - index + count) % count;
          const position = offset === 0 ? "current" : offset === 1 ? "next" : offset === 2 ? "later" : offset === count - 1 && count > 3 ? "gone" : "hidden";
          return (
            <figure
              key={review.id}
              className={`review-card is-${position}`}
              aria-hidden={offset !== 0}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
            >
              <span className="review-quote" aria-hidden="true">“</span>
              {review.rating ? (
                <span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: Math.round(review.rating) }, (_, s) => (
                    <Icon key={s} name="star" size={14} />
                  ))}
                </span>
              ) : null}
              <blockquote>{review.text}</blockquote>
              <figcaption>
                <span className="review-avatar" aria-hidden="true">
                  {initials(review.name)}
                </span>
                <span>
                  <b>{review.name}</b>
                  <small>
                    {review.date}
                    {review.translated ? " · translated by Airbnb" : ""}
                  </small>
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className="review-deck-foot">
        <div className="review-progress" aria-hidden="true">
          <span key={`${index}-${cycle}`} style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />
        </div>
        <button type="button" className="review-arrow" aria-label="Previous review" onClick={() => go(-1)} disabled={count < 2}>
          <Icon name="arrow" size={18} />
        </button>
        <button type="button" className="review-arrow is-next" aria-label="Next review" onClick={() => go(1)} disabled={count < 2}>
          <Icon name="arrow" size={18} />
        </button>
      </div>
      <a className="review-all" href={reviewsUrl} target="_blank" rel="noreferrer">
        All reviews on Airbnb <Icon name="arrow" size={14} />
      </a>
    </div>
  );
}
