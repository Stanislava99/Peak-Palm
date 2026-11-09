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
          <h4>Ski · Bansko</h4>
          <a href="/villa-kaja">Villa Kaja</a>
          <span>Bansko, Bulgaria</span>
          <a href={properties.kaja.airbnbUrl} target="_blank" rel="noreferrer">
            On Airbnb
          </a>
        </div>
        <div>
          <h4>Sea · Greece</h4>
          <a href="/janis">Jani’s Beach House</a>
          <span>Neoi Epivates, Greece</span>
          <a href={properties.janis.airbnbUrl} target="_blank" rel="noreferrer">
            On Airbnb
          </a>
        </div>
        <div>
          <h4>Stay</h4>
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
      </div>
    </footer>
  );
}
