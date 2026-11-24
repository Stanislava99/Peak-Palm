import { Icon } from "./Icons";

/** On the Villa Kaja page: a short invitation that opens the ski rental page. */
export function RentalTeaser() {
  return (
    <section id="ski-rental" className="section rental-teaser">
      <div className="rental-teaser-card">
        <span className="rental-teaser-icon" aria-hidden="true">
          <Icon name="ski" size={28} />
        </span>
        <div>
          <p className="eyebrow">Skis &amp; ski school</p>
          <h2>Want to reserve your ski lessons or equipment?</h2>
          <p>
            Skis, snowboards, boots, helmets and lessons from our partner shop in Bansko, ready when you arrive. Reserve
            here, even if you booked Villa Kaja on Airbnb or Booking.com. Nothing is paid online.
          </p>
        </div>
        <a className="button primary" href="/ski-rental">
          Reserve here <Icon name="arrow" size={16} />
        </a>
      </div>
    </section>
  );
}
