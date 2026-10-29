"use client";

import { useEffect, useState } from "react";
import type { Photo } from "@/lib/photos";

type Props = {
  photos: Photo[];
  rooms: readonly string[];
  title: string;
  intro: string;
};

export function Gallery({ photos, rooms, title, intro }: Props) {
  const [room, setRoom] = useState(rooms[0] ?? "All");
  const [active, setActive] = useState<number | null>(null);
  const visible = room === "All" ? photos : photos.filter((photo) => photo.room === room);

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowRight") setActive((index) => (index === null ? index : (index + 1) % visible.length));
      if (event.key === "ArrowLeft") {
        setActive((index) => (index === null ? index : (index - 1 + visible.length) % visible.length));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, visible.length]);

  const current: Photo | null = active === null ? null : visible[active];

  return (
    <section id="gallery" className="section gallery-section">
      <div className="section-head">
        <p className="eyebrow">From the listings</p>
        <h2>{title}</h2>
        <p>{intro}</p>
      </div>
      <div className="filters" role="tablist" aria-label="Photo rooms">
        {rooms.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={room === name}
            className={room === name ? "is-on" : ""}
            onClick={() => {
              setRoom(name);
              setActive(null);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="gallery-grid">
        {visible.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            className="shot"
            onClick={() => setActive(index)}
          >
            <img src={photo.src} alt={photo.alt} />
            <span>{photo.caption}</span>
          </button>
        ))}
      </div>
      {current ? (
        <dialog className="lightbox" open aria-label={current.caption}>
          <button className="lightbox-close" type="button" onClick={() => setActive(null)}>
            Close
          </button>
          <button
            className="lightbox-nav prev"
            type="button"
            onClick={() => setActive((index) => (index === null ? index : (index - 1 + visible.length) % visible.length))}
          >
            Previous
          </button>
          <figure>
            <img src={current.src} alt={current.alt} />
            <figcaption>
              {current.caption}
              <em>{current.room}</em>
            </figcaption>
          </figure>
          <button
            className="lightbox-nav next"
            type="button"
            onClick={() => setActive((index) => (index === null ? index : (index + 1) % visible.length))}
          >
            Next
          </button>
        </dialog>
      ) : null}
    </section>
  );
}
