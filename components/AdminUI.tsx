"use client";

import { useEffect, useRef, useState } from "react";

/** Keyboard + focus handling for the booking side panel: Esc closes it, focus moves into it. */
export function DrawerKeys({ closeHref }: { closeHref: string }) {
  useEffect(() => {
    const panel = document.getElementById("adm-drawer");
    panel?.focus();
    document.documentElement.classList.add("adm-locked");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.location.assign(closeHref);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("adm-locked");
    };
  }, [closeHref]);
  return null;
}

/**
 * Instant search over server-rendered rows: hides every `[data-search]` element inside
 * `#target` whose text doesn't contain all the typed words. Optional chip filters match `data-tags`.
 */
export function FilterBox({
  target,
  placeholder,
  chips = [],
}: {
  target: string;
  placeholder: string;
  chips?: Array<{ value: string; label: string }>;
}) {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const box = document.getElementById(target);
    if (!box) return;
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    box.querySelectorAll<HTMLElement>("[data-search]").forEach((row) => {
      const text = (row.dataset.search ?? "").toLowerCase();
      const tags = (row.dataset.tags ?? "").split(" ");
      const ok = words.every((w) => text.includes(w)) && (!chip || tags.includes(chip));
      row.hidden = !ok;
      if (ok) shown += 1;
    });
    const empty = box.querySelector<HTMLElement>("[data-empty]");
    if (empty) empty.hidden = shown > 0;
    if (first.current) first.current = false;
    else setCount(shown);
  }, [query, chip, target]);

  return (
    <div className="adm-filter">
      <label className="adm-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </label>
      {chips.length ? (
        <div className="adm-chips" role="group" aria-label="Filter">
          {[{ value: "", label: "All" }, ...chips].map((c) => (
            <button key={c.value || "all"} type="button" aria-pressed={chip === c.value} onClick={() => setChip(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
      <span className="adm-count" aria-live="polite">
        {count === null ? "" : `${count} shown`}
      </span>
    </div>
  );
}
