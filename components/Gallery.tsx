"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Photo } from "@/lib/photos";
import { Arrow, useCarousel } from "./Carousel";

type Props = {
  photos: Photo[];
  rooms: readonly string[];
  title: string;
  intro: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function Gallery({ photos, rooms, title, intro }: Props) {
  const [room, setRoom] = useState(rooms[0] ?? "All");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const visible = room === "All" ? photos : photos.filter((photo) => photo.room === room);
  const { index, goTo, trackProps, wasDragged } = useCarousel(visible.length);

  function chooseRoom(name: string) {
    setRoom(name);
    requestAnimationFrame(() => goTo(0, false));
  }

  if (!visible.length) return null;
  const progress = ((index + 1) / visible.length) * 100;

  return (
    <section id="gallery" className="section gallery-section">
      <div className="gallery-head">
        <div>
          <p className="eyebrow">Gallery</p>
          <h2>{title}</h2>
          <p>{intro}</p>
        </div>
        <div className="gallery-controls">
          <p className="gallery-count" aria-live="polite">
            <strong>{pad(index + 1)}</strong>
            <span> / {pad(visible.length)}</span>
          </p>
          <button className="round-button" type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous photo">
            <Arrow dir="prev" />
          </button>
          <button
            className="round-button"
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index === visible.length - 1}
            aria-label="Next photo"
          >
            <Arrow dir="next" />
          </button>
        </div>
      </div>

      <div className="filters" role="tablist" aria-label="Photo rooms">
        {rooms.map((name) => {
          const count = name === "All" ? photos.length : photos.filter((photo) => photo.room === name).length;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={room === name}
              className={room === name ? "is-on" : ""}
              onClick={() => chooseRoom(name)}
            >
              {name} <small>{count}</small>
            </button>
          );
        })}
      </div>

      <div className="carousel" {...trackProps} tabIndex={0} role="region" aria-label={`${title}, photo carousel`}>
        {visible.map((photo, i) => (
          <figure key={`${room}-${photo.src}`} className={`slide${i === index ? " is-active" : ""}`}>
            <button
              type="button"
              className="slide-open"
              onClick={() => {
                if (wasDragged()) return;
                if (i !== index) goTo(i);
                else setLightbox(i);
              }}
              aria-label={i === index ? `Open ${photo.caption} full screen` : `Show ${photo.caption}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 900px) 88vw, 72vw"
                draggable={false}
                priority={i === 0}
              />
            </button>
            <figcaption>
              <span>{photo.room}</span>
              {photo.caption}
            </figcaption>
            <span className="slide-expand" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </span>
          </figure>
        ))}
      </div>

      <div className="carousel-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      {lightbox !== null ? (
        <Lightbox photos={visible} start={lightbox} onClose={(last) => {
          setLightbox(null);
          goTo(last, false);
        }} />
      ) : null}
    </section>
  );
}

function Lightbox({ photos, start, onClose }: { photos: Photo[]; start: number; onClose: (index: number) => void }) {
  const { ref, index, goTo, trackProps } = useCarousel(photos.length);
  const current = photos[index] ?? photos[0];

  useEffect(() => {
    goTo(start, false);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose(index);
      if (event.key === "ArrowRight") goTo(index + 1);
      if (event.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goTo, onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div className="lightbox-bar">
        <p>
          <strong>{pad(index + 1)}</strong> / {pad(photos.length)}
          <span>{current.caption}</span>
        </p>
        <button className="round-button light" type="button" onClick={() => onClose(index)} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="lightbox-track" {...trackProps} tabIndex={-1}>
        {photos.map((photo, i) => (
          <figure key={photo.src} className="lightbox-slide">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="100vw"
              quality={85}
              draggable={false}
              loading={Math.abs(i - start) <= 1 ? "eager" : "lazy"}
            />
          </figure>
        ))}
      </div>
      <button className="round-button light lightbox-nav prev" type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous photo">
        <Arrow dir="prev" />
      </button>
      <button
        className="round-button light lightbox-nav next"
        type="button"
        onClick={() => goTo(index + 1)}
        disabled={index === photos.length - 1}
        aria-label="Next photo"
      >
        <Arrow dir="next" />
      </button>
      <div className="lightbox-thumbs">
        {photos.map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            className={i === index ? "is-on" : ""}
            onClick={() => goTo(i)}
            aria-label={photo.caption}
            aria-current={i === index}
            ref={(el) => {
              if (el && i === index) el.scrollIntoView({ block: "nearest", inline: "center" });
            }}
          >
            <Image src={photo.src} alt="" width={120} height={80} sizes="60px" />
          </button>
        ))}
      </div>
    </div>
  );
}
