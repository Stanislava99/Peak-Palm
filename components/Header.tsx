"use client";

import { useEffect, useState } from "react";

const links = [
  { href: "#house", label: "The house" },
  { href: "#gallery", label: "Gallery" },
  { href: "#stay", label: "Availability" },
  { href: "#location", label: "Location" },
];

export function Header({ brand }: { brand: string }) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${solid || open ? "is-solid" : ""}`}>
      <a className="brand" href="#top">
        {brand}
      </a>
      <nav className={open ? "is-open" : ""} aria-label="Sections">
        <a href="/" onClick={() => setOpen(false)}>
          Both houses
        </a>
        {links.map((link) => (
          <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </a>
        ))}
        <a className="nav-book" href="#stay" onClick={() => setOpen(false)}>
          Check dates
        </a>
      </nav>
      <button
        className="menu-toggle"
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
      </button>
    </header>
  );
}
