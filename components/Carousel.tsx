"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Shared logic for scroll-snap carousels: native swipe on touch,
 * drag on desktop, arrow/keyboard control, and the active index.
 */
export function useCarousel(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const dragged = useRef(false);

  const step = useCallback(() => {
    const track = ref.current;
    const first = track?.children[0] as HTMLElement | undefined;
    const second = track?.children[1] as HTMLElement | undefined;
    if (!track || !first) return 1;
    return second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
  }, []);

  const goTo = useCallback(
    (next: number, smooth = true) => {
      const track = ref.current;
      if (!track || !count) return;
      const target = Math.max(0, Math.min(count - 1, next));
      track.scrollTo({ left: target * step(), behavior: smooth ? "smooth" : "auto" });
      setIndex(target);
    },
    [count, step],
  );

  useEffect(() => {
    const track = ref.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
        setIndex(atEnd ? count - 1 : Math.round(track.scrollLeft / step()));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [count, step]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !ref.current) return;
    drag.current = { x: event.clientX, left: ref.current.scrollLeft, moved: false };
    dragged.current = false;
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const track = ref.current;
    if (!state || !track) return;
    const dx = event.clientX - state.x;
    if (!state.moved && Math.abs(dx) > 6) {
      state.moved = true;
      track.classList.add("is-dragging");
      track.setPointerCapture(event.pointerId);
    }
    if (state.moved) track.scrollLeft = state.left - dx;
  };
  const endDrag = () => {
    const state = drag.current;
    const track = ref.current;
    drag.current = null;
    if (!state?.moved || !track) return;
    dragged.current = true;
    track.classList.remove("is-dragging");
    goTo(Math.round(track.scrollLeft / step()));
  };

  return {
    ref,
    index,
    goTo,
    /** True right after a mouse drag, so the drag does not count as a click. */
    wasDragged: () => {
      const value = dragged.current;
      dragged.current = false;
      return value;
    },
    trackProps: {
      ref,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          goTo(index + 1);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goTo(index - 1);
        }
      },
    },
  };
}

export function Arrow({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === "next" ? <path d="M5 12h14M13 6l6 6-6 6" /> : <path d="M19 12H5M11 6l-6 6 6 6" />}
    </svg>
  );
}

/** Small swipeable photo slider used on the home-page house cards. */
export function CardSlider({
  photos,
  href,
  label,
  children,
}: {
  photos: Array<{ src: string; alt: string }>;
  href: string;
  label: string;
  children?: React.ReactNode;
}) {
  const { index, goTo, trackProps, wasDragged } = useCarousel(photos.length);

  return (
    <div className="card-slider">
      <div className="card-slider-track" {...trackProps} tabIndex={0} aria-label={`${label} photos`} role="region">
        {photos.map((photo, i) => (
          <a
            key={photo.src}
            className="card-slide"
            href={href}
            tabIndex={-1}
            onClick={(event) => {
              if (wasDragged()) event.preventDefault();
            }}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
              draggable={false}
              priority={i === 0}
            />
          </a>
        ))}
      </div>
      {children}
      <button className="card-slider-arrow prev" type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous photo">
        <Arrow dir="prev" />
      </button>
      <button
        className="card-slider-arrow next"
        type="button"
        onClick={() => goTo(index + 1)}
        disabled={index === photos.length - 1}
        aria-label="Next photo"
      >
        <Arrow dir="next" />
      </button>
      <div className="card-slider-dots" aria-hidden="true">
        {photos.map((photo, i) => (
          <span key={photo.src} className={i === index ? "is-on" : ""} />
        ))}
      </div>
    </div>
  );
}
