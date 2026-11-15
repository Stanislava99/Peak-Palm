import Image from "next/image";
import { HOST_REPLY } from "@/lib/booking-config";
import { FAMILY, hostsFor } from "@/lib/hosts";
import type { PropertyId } from "@/lib/properties";
import { AskForm } from "./Enquiry";
import { Icon } from "./Icons";

function monogram(name: string) {
  return name.slice(0, 1).toUpperCase();
}

/** "Meet your host(s)": the family story beside their photo, then the ask-a-question band. */
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
  const photo = FAMILY.photo ?? lead?.photo ?? null;
  const photoAlt = FAMILY.photo ? FAMILY.alt : `${lead?.name ?? "Your host"}, host`;

  return (
    <section id="ask" className="section hosts">
      <div className="hosts-story">
        <figure className="hosts-photo">
          <div className="hosts-photo-frame">
            {photo ? (
              <Image src={photo} alt={photoAlt} fill sizes="(max-width: 900px) 92vw, 460px" />
            ) : (
              <span className="hosts-photo-monogram" aria-hidden="true">
                {monogram(lead?.name ?? "S")}
              </span>
            )}
          </div>
        </figure>

        <div className="hosts-text">
          <p className="eyebrow">{plural ? "Meet your hosts" : "Meet your host"} · a family business</p>
          <h2>{plural ? `Say hello to ${names}` : `Say hello to ${lead?.name ?? "your host"} & family`}</h2>
          {hosts.map((host) => (
            <p key={host.name} className="hosts-lead">
              {host.bio}
            </p>
          ))}
          <p className="hosts-signoff">— {plural ? names : `${lead?.name ?? "Your host"} & family`}</p>
          {lead?.languages.length ? <p className="host-langs">Speaks {lead.languages.join(", ")}</p> : null}

          <dl className="hosts-stats">
            <div>
              <dt>Guest reviews</dt>
              <dd>{reviewCount}</dd>
            </div>
            {communication ? (
              <div>
                <dt>Communication</dt>
                <dd>
                  {communication.toFixed(2)}
                  <Icon name="star" size={14} />
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Replies</dt>
              <dd className="is-text">{HOST_REPLY}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="hosts-ask">
        <div className="hosts-ask-intro">
          <Icon name="chat" size={26} />
          <h3>
            Ask {plural ? "us" : lead?.name ?? "the host"} about {house}
          </h3>
          <p>Arrival times, extra beds, the area: anything. You’ll get a reply by email. A question doesn’t hold any dates.</p>
        </div>
        <AskForm property={property} hostName={plural ? "We" : lead?.name ?? "The host"} />
      </div>
    </section>
  );
}
