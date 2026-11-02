import Image from "next/image";
import { HOST_REPLY } from "@/lib/booking-config";
import { hostsFor } from "@/lib/hosts";
import type { PropertyId } from "@/lib/properties";
import { AskForm } from "./Enquiry";
import { Icon } from "./Icons";

function monogram(name: string) {
  return name.slice(0, 1).toUpperCase();
}

/** "Meet your host(s)", followed directly by the ask-a-question form. */
export function MeetHosts({
  property,
  house,
  reviewCount,
  communication,
}: {
  property: PropertyId;
  house: string;
  reviewCount: number;
  communication?: number;
}) {
  const hosts = hostsFor(property);
  const lead = hosts[0];
  const plural = hosts.length > 1;
  const names = hosts.map((h) => h.name).join(" & ");

  return (
    <section id="ask" className="section hosts">
      <div className="hosts-intro">
        <p className="eyebrow">{plural ? "Meet your hosts" : "Meet your host"}</p>
        <h2>{plural ? `Say hello to ${names}` : `Say hello to ${lead?.name ?? "your host"}`}</h2>
      </div>

      <div className="hosts-grid">
        <div className="hosts-people">
          {hosts.map((host) => (
            <article key={host.name} className="host-card">
              <div className="host-portrait">
                {host.photo ? (
                  <Image src={host.photo} alt={`${host.name}, host`} fill sizes="120px" />
                ) : (
                  <span aria-hidden="true">{monogram(host.name)}</span>
                )}
                {host.superhost ? (
                  <span className="host-badge" title="Airbnb Superhost">
                    <Icon name="star" size={13} />
                  </span>
                ) : null}
              </div>
              <div className="host-body">
                <h3>{host.name}</h3>
                <p className="host-role">{host.role}</p>
                <p className="host-bio">{host.bio}</p>
                {host.languages.length ? <p className="host-langs">Speaks {host.languages.join(", ")}</p> : null}
              </div>
            </article>
          ))}

          <ul className="host-facts">
            {lead?.superhost ? (
              <li>
                <Icon name="star" size={18} />
                <span>
                  <b>Superhost</b> on Airbnb
                </span>
              </li>
            ) : null}
            <li>
              <Icon name="chat" size={18} />
              <span>
                <b>{reviewCount}</b> guest reviews
              </span>
            </li>
            {communication ? (
              <li>
                <Icon name="sparkle" size={18} />
                <span>
                  <b>{communication.toFixed(2)}</b> for communication
                </span>
              </li>
            ) : null}
            <li>
              <Icon name="calendar" size={18} />
              <span>
                Replies <b>{HOST_REPLY}</b>
              </span>
            </li>
          </ul>
        </div>

        <div className="hosts-ask">
          <h3>Ask {plural ? "us" : lead?.name ?? "the host"} about {house}</h3>
          <p>Arrival times, extra beds, the area: anything. You’ll get a reply by email. A question doesn’t hold any dates.</p>
          <AskForm property={property} hostName={plural ? "We" : lead?.name ?? "The host"} />
        </div>
      </div>
    </section>
  );
}
