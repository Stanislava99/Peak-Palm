import { QUESTION_REPLY } from "@/lib/booking-config";
import { brand } from "@/lib/brand";
import { HOSTS, phoneDigits } from "@/lib/hosts";
import { contactEmail } from "@/lib/site-config";
import { Icon } from "./Icons";

/** Phone numbers under the ask form on house pages (the form itself goes to the bookings email). */
export function ContactLines() {
  return (
    <ul className="contact-lines">
      {HOSTS.filter((host) => host.phone).map((host) => {
        const digits = phoneDigits(host.phone!);
        return (
          <li key={host.name}>
            <span className="contact-lines-name">{host.name}</span>
            <a className="contact-lines-main" href={`tel:+${digits}`}>
              <Icon name="phone" size={16} /> {host.phone}
            </a>
            {host.whatsapp || host.viber ? (
              <span className="contact-apps">
                {host.whatsapp ? (
                  <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                ) : null}
                {host.viber ? <a href={`viber://chat?number=%2B${digits}`}>Viber</a> : null}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** "Contact us" (home page): Frosina and Nikola's phone numbers, WhatsApp / Viber, and the bookings email. */
export function ContactUs() {
  const email = contactEmail();

  return (
    <section id="contact" className="section contact">
      <div className="section-head centered">
        <p className="eyebrow">Contact us</p>
        <h2>Talk to {brand.hosts}</h2>
        <p className="contact-lede">
          Frosina and her husband Nikola run Sea &amp; Ski together and look after both houses. Call or message either of
          them about dates, arrival, extra beds or anything else. {brand.host} replies to every message and email{" "}
          {QUESTION_REPLY}.
        </p>
      </div>

      <ul className="contact-cards">
        {HOSTS.map((host) => {
          const digits = host.phone ? phoneDigits(host.phone) : "";
          return (
            <li key={host.name} className="contact-card">
              <span className="contact-monogram" aria-hidden="true">
                {host.name.slice(0, 1)}
              </span>
              <h3>{host.name}</h3>
              <p className="contact-role">{host.role}</p>
              {host.phone ? (
                <>
                  <a className="contact-phone" href={`tel:+${digits}`}>
                    <Icon name="phone" size={18} /> {host.phone}
                  </a>
                  {host.whatsapp || host.viber ? (
                    <p className="contact-apps">
                      {host.whatsapp ? (
                        <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer">
                          WhatsApp
                        </a>
                      ) : null}
                      {host.viber ? <a href={`viber://chat?number=%2B${digits}`}>Viber</a> : null}
                    </p>
                  ) : null}
                </>
              ) : null}
            </li>
          );
        })}
        <li className="contact-card">
          <span className="contact-monogram" aria-hidden="true">
            <Icon name="mail" size={22} />
          </span>
          <h3>Email</h3>
          <p className="contact-role">For bookings and anything in writing</p>
          <a className="contact-phone" href={`mailto:${email}`}>
            {email}
          </a>
        </li>
      </ul>
    </section>
  );
}
