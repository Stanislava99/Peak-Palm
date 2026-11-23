"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { UNTRACKED_PATHS } from "@/lib/analytics";
import { houseFromPath, track, type TrackEvent } from "@/lib/track";

const ROOM_HOUSE: Record<string, string> = { "1849518": "kaja", "26322352": "janis" };

/** Where on the page a link sits: the nearest section id, or header/footer. */
function placeOf(el: Element): string {
  if (el.closest(".mobile-bar")) return "mobile-bar";
  if (el.closest("header")) return "header";
  if (el.closest("footer")) return "footer";
  const section = el.closest("section[id], [id]");
  return section?.id || "page";
}

function classify(href: string): { event: TrackEvent; house?: string } | null {
  if (href.startsWith("tel:")) return { event: "Phone click" };
  if (href.startsWith("mailto:")) return { event: "Email click" };
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (/(^|\.)airbnb\.[a-z.]+$/.test(host)) {
    const room = url.pathname.match(/\/rooms\/(\d+)/)?.[1];
    return { event: "Airbnb click", house: room ? ROOM_HOUSE[room] : undefined };
  }
  if (host.endsWith("booking.com")) return { event: "Booking.com click", house: "kaja" };
  if (host === "wa.me" || host.endsWith("whatsapp.com")) return { event: "WhatsApp click" };
  if (/(instagram|facebook|fb)\.com$/.test(host)) return { event: "Social click" };
  if (url.origin === window.location.origin && url.hash === "#stay") return { event: "Choose dates click" };
  return null;
}

/**
 * Loads Umami (live site only; the server decides via analyticsWebsiteId) and records clicks on
 * Airbnb / Booking.com / contact links anywhere on the site, without touching each link.
 */
export function Analytics({ websiteId }: { websiteId: string | null }) {
  const pathname = usePathname() ?? "/";
  const off = !websiteId || UNTRACKED_PATHS.test(pathname);

  useEffect(() => {
    if (off) return;
    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link) return;
      const kind = classify(link.getAttribute("href") ?? "");
      if (!kind) return;
      const path = window.location.pathname;
      const house = kind.house ?? houseFromPath(path);
      track(kind.event, { house, place: placeOf(link), page: houseFromPath(path) });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [off]);

  if (off) return null;
  return (
    <Script
      // Not "umami": an element id becomes a window global, and the tracker only installs
      // window.umami.track when window.umami is still empty (custom events were silently lost).
      id="umami-tracker"
      src="/stats/script.js"
      strategy="afterInteractive"
      data-website-id={websiteId!}
      data-host-url="/stats"
      data-exclude-search="true"
      data-exclude-hash="true"
    />
  );
}
