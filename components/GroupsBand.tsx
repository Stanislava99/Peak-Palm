import { Icon, type IconName } from "@/components/Icons";

export type GroupType = [IconName, string, string];

/** Dark band that says who the whole house suits, with a link down to the calendar. */
export function GroupsBand({
  maxGuests,
  intro,
  types,
}: {
  maxGuests: number;
  intro: string;
  types: GroupType[];
}) {
  return (
    <section id="groups" className="section groups" aria-labelledby="groups-title">
      <div className="groups-intro">
        <p className="eyebrow light">Groups and families</p>
        <h2 id="groups-title">One house for up to {maxGuests} people</h2>
        <p>{intro}</p>
        <a className="groups-link" href="#stay">
          Check dates for your group <Icon name="arrow" size={18} />
        </a>
      </div>
      <div className="groups-cards">
        {types.map(([icon, title, text]) => (
          <article key={title}>
            <span className="groups-icon"><Icon name={icon} size={22} /></span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
