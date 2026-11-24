"use client";

import { useEffect, useState } from "react";
import { DEFAULT_DISCOUNT, discountLabel } from "@/lib/price-math";
import { Lockup } from "./Logo";

const sectionLinks: Array<{ href: string; label: string; extra?: boolean }> = [
  { href: "#house", label: "The house" },
  { href: "#gallery", label: "Gallery" },
  { href: "#stay", label: "Availability" },
  { href: "#reviews", label: "Reviews", extra: true },
  { href: "#contact", label: "Contact" },
  { href: "#faq", label: "FAQ", extra: true },
  { href: "#location", label: "Location" },
];

type Props = {
  /** House pages pass section links; the home page passes none. */
  sections?: boolean;
  sibling?: { href: string; label: string };
  /** House name shown beside the logo on house pages. */
  house?: string;
  /** Direct-booking discount in % (admin → Prices). */
  discount?: number;
  /** Adds "Skis & school" (the /ski-rental page) to the section links. */
  skiRental?: boolean;
};

export function Header({ sections = true, sibling, house, discount = DEFAULT_DISCOUNT, skiRental = false }: Props) {
  const DIRECT_DISCOUNT_LABEL = discountLabel(discount);
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links: Array<{ href: string; label: string; extra?: boolean }> = sections
    ? skiRental
      ? [...sectionLinks.slice(0, 3), { href: "/ski-rental", label: "Skis & school" }, ...sectionLinks.slice(3)]
      : sectionLinks
    : [
        { href: "/villa-kaja", label: "Villa Kaja" },
        { href: "/janis", label: "Jani’s Beach House" },
        { href: "#contact", label: "Contact" },
      ];

  return (
    <header className={`site-header ${solid || open ? "is-solid" : ""}`}>
      {discount > 0 ? (
      <a className="promo-bar" href={sections ? "#stay" : "#houses"}>
        <b>Book direct, save {DIRECT_DISCOUNT_LABEL}.</b>
        <span> Same houses, same host, {DIRECT_DISCOUNT_LABEL} less than on booking platforms.</span>
        <i aria-hidden="true">→</i>
      </a>
      ) : null}
      <div className="header-row">
      <a className="brand" href="/">
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
          <a key={link.href} href={link.href} className={link.extra ? "nav-extra" : undefined} onClick={() => setOpen(false)}>
            {link.label}
          </a>
        ))}
        {sibling ? (
          <a className="nav-sibling" href={sibling.href} onClick={() => setOpen(false)}>
            {sibling.label}
          </a>
        ) : null}
        <a className="nav-book" href={sections ? "#stay" : "#houses"} onClick={() => setOpen(false)}>
          {sections ? (discount > 0 ? `Book direct −${DIRECT_DISCOUNT_LABEL}` : "Book direct") : "Choose a house"}
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
