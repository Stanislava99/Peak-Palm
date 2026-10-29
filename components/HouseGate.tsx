"use client";

import { useState } from "react";

type Season = "winter" | "summer";

export function HouseGate() {
  const [focus, setFocus] = useState<Season | null>(null);

  return (
    <main className={`gate${focus ? ` focus-${focus}` : ""}`}>
      <header className="gate-top">
        <div className="gate-lockup">
          <p>Two houses</p>
          <h1>Winter and summer</h1>
          <p className="gate-lede">A chalet in Bansko for the snow. A beach house on the gulf for the sea.</p>
        </div>
      </header>
      <a
        className="gate-pane winter"
        href="/villa-kaja"
        onMouseEnter={() => setFocus("winter")}
        onMouseLeave={() => setFocus(null)}
        onFocus={() => setFocus("winter")}
        onBlur={() => setFocus(null)}
      >
        <img src="/photos/01-exterior.jpg" alt="" />
        <span className="gate-shade" />
        <span className="gate-copy">
          <em>Winter</em>
          <strong>Villa Kaja</strong>
          <span>Bansko · a private chalet by the gondola</span>
          <i>Open</i>
        </span>
      </a>
      <a
        className="gate-pane summer"
        href="/janis"
        onMouseEnter={() => setFocus("summer")}
        onMouseLeave={() => setFocus(null)}
        onFocus={() => setFocus("summer")}
        onBlur={() => setFocus(null)}
      >
        <img src="/photos/janis/01-cover.jpg" alt="" />
        <span className="gate-shade" />
        <span className="gate-copy">
          <em>Summer</em>
          <strong>Jani’s Beach House</strong>
          <span>Neoi Epivates · a short walk to the sand</span>
          <i>Open</i>
        </span>
      </a>
    </main>
  );
}
