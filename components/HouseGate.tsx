"use client";

import Image from "next/image";
import { useState } from "react";
import { brand } from "@/lib/brand";
import { Lockup } from "./Logo";

type Side = "peak" | "palm";

export function HouseGate() {
  const [focus, setFocus] = useState<Side | null>(null);

  const hover = (side: Side) => ({
    onMouseEnter: () => setFocus(side),
    onMouseLeave: () => setFocus(null),
    onFocus: () => setFocus(side),
    onBlur: () => setFocus(null),
  });

  return (
    <section className={`gate${focus ? ` focus-${focus}` : ""}`} aria-label="Choose a house">
      <div className="gate-top">
        <div className="gate-lockup">
          <h1 className="sr-only">{brand.name}</h1>
          <Lockup tone="light" layout="stack" cut="transparent" />
          <p className="gate-lede">{brand.tagline}</p>
        </div>
      </div>
      <a className="gate-pane winter" href="/villa-kaja" {...hover("peak")}>
        <Image src="/photos/01-exterior.jpg" alt="" fill priority sizes="100vw" />
        <span className="gate-shade" />
        <span className="gate-copy">
          <em>The Peak · Winter</em>
          <strong>Villa Kaja</strong>
          <span>Bansko, Bulgaria · a private chalet five minutes from the gondola</span>
          <i>
            Explore the chalet <b aria-hidden="true">→</b>
          </i>
        </span>
      </a>
      <a className="gate-pane summer" href="/janis" {...hover("palm")}>
        <Image src="/photos/janis/01-cover.jpg" alt="" fill priority sizes="100vw" />
        <span className="gate-shade" />
        <span className="gate-copy">
          <em>The Palm · Summer</em>
          <strong>Jani’s Beach House</strong>
          <span>Neoi Epivates, Greece · about 30 metres from the sand</span>
          <i>
            Explore the beach house <b aria-hidden="true">→</b>
          </i>
        </span>
      </a>
      <a className="gate-scroll" href="#houses" aria-label="Scroll to the houses">
        <span />
      </a>
    </section>
  );
}
