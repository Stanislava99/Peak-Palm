import { brand } from "@/lib/brand";
import { properties } from "@/lib/properties";
import { Lockup } from "./Logo";

export function Footer({ address }: { address?: string }) {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Lockup tone="light" layout="stack" />
        <p className="footer-tagline">{brand.tagline}</p>
      </div>
      <div className="footer-cols">
        <div>
          <h2>Ski · Bansko</h2>
          <a href="/villa-kaja">Villa Kaja</a>
          <span>Bansko, Bulgaria</span>
          {properties.kaja.registration ? (
            <span className="footer-reg">
              {properties.kaja.registration.label} {properties.kaja.registration.number}
            </span>
          ) : null}
          <a href={properties.kaja.airbnbUrl} target="_blank" rel="noreferrer">
            On Airbnb
          </a>
        </div>
        <div>
          <h2>Sea · Greece</h2>
          <a href="/janis">Jani’s Beach House</a>
          <span>Neoi Epivates, Greece</span>
          {properties.janis.registration ? (
            <span className="footer-reg">
              {properties.janis.registration.label} {properties.janis.registration.number}
            </span>
          ) : null}
          <a href={properties.janis.airbnbUrl} target="_blank" rel="noreferrer">
            On Airbnb
          </a>
        </div>
        <div>
          <h2>Stay</h2>
          <a href="/villa-kaja#stay">Winter dates</a>
          <a href="/janis#stay">Summer dates</a>
          <a href="/villa-kaja#ask">Ask the host</a>
        </div>
      </div>
      <div className="footer-base">
        <span>
          © {new Date().getFullYear()} {brand.name}
          {address ? ` · ${address}` : ""}
        </span>
        <span>
          Hosted by {brand.host} · <a href="/privacy">Privacy</a>
        </span>
        <a className="footer-credit" href="https://lunadigital.pro/index.html" target="_blank" rel="noopener">
          Made by
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M20 3a13 13 0 1 0 9 22A11 11 0 0 1 20 3z" />
          </svg>
          <b>Luna Digital</b>
        </a>
      </div>
    </footer>
  );
}
