"use client";

import { useEffect, useRef } from "react";

/** Horizontal scroller for the admin calendar: on small screens it opens at today, not the 1st. */
export function CalendarScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const today = box?.querySelector<HTMLElement>(".cal-day.is-today");
    const name = box?.querySelector<HTMLElement>(".cal-name");
    if (!box || !today || box.scrollWidth <= box.clientWidth) return;
    const shift = today.getBoundingClientRect().left - box.getBoundingClientRect().left - (name?.offsetWidth ?? 0) - 36;
    box.scrollLeft = Math.max(0, box.scrollLeft + shift);
  }, []);
  return (
    <div className="cal-scroll" ref={ref}>
      {children}
    </div>
  );
}
