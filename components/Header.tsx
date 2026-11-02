"use client";

import { useEffect, useState } from "react";
import { DIRECT_DISCOUNT_LABEL } from "@/lib/pricing";
import { Lockup } from "./Logo";

const sectionLinks = [
  { href: "#house", label: "The house" },
  { href: "#gallery", label: "Gallery" },
  { href: "#stay", label: "Availability" },
  { href: "#location", label: "Location" },
];

type Props = {
  /** House pages pass section links; the home page passes none. */
  sections?: boolean;
  sibling?: { href: string; label: string };
  /** House name shown beside the logo on house pages. */
  house?: string;
};

export function Header({ sections = true, sibling, house }: Props) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = sections
    ? sectionLinks
    : [
        { href: "/villa-kaja", label: "Villa Kaja" },
        { href: "/janis", label: "Jani’s Beach House" },
      ];

  return (
    <header className={`site-header ${solid || open ? "is-solid" : ""}`}>
      <a className="promo-bar" href={sections ? "#stay" : "#houses"}>
        <b>Book direct, save {DIRECT_DISCOUNT_LABEL}.</b>
        <span> Same houses, same host, {DIRECT_DISCOUNT_LABEL} less than the Airbnb price.</span>
        <i aria-hidden="true">→</i>
      </a>
      <div className="header-row">
      <a className="brand" href="/" aria-label="Peak & Palm Villas, home">
        <span className="brand-light">
          <Lockup tone="light" cut="transparent" />
        </span>
        <span className="brand-dark">
          <Lockup tone="dark" />
        </span>
      </a>
      {house ? (
        <a className="header-house" href="#top">
          {house}
        </a>
      ) : null}
      <nav className={open ? "is-open" : ""} aria-label="Main">
        {links.map((link) => (
          <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </a>
        ))}
        {sibling ? (
          <a className="nav-sibling" href={sibling.href} onClick={() => setOpen(false)}>
            {sibling.label}
          </a>
        ) : null}
        <a className="nav-book" href={sections ? "#stay" : "#houses"} onClick={() => setOpen(false)}>
          {sections ? `Book direct −${DIRECT_DISCOUNT_LABEL}` : "Choose a house"}
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
      </div>
    </header>
  );
}
