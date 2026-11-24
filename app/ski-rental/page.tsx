import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icons";
import { RentalReserve } from "@/components/RentalReserve";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ski equipment & ski school in Bansko",
  description:
    "Reserve ski and snowboard equipment and ski school lessons in Bansko for your stay at Villa Kaja. Nothing is paid online: you pay the shop in Bansko.",
  alternates: { canonical: "/ski-rental" },
};

/** Ski equipment / ski school reservation for Villa Kaja guests, wherever they booked. */
export default function SkiRentalPage() {
  return (
    <div className="checkout-page">
      <Header sections={false} house="Villa Kaja" />
      <main className="checkout rental-page" id="top">
        <div className="checkout-head">
          <a className="checkout-back" href="/villa-kaja">
            <Icon name="arrow" size={16} className="flip" /> Villa Kaja
          </a>
          <p className="eyebrow">Skis &amp; ski school · Bansko</p>
          <h1>Reserve your skis and lessons</h1>
          <p>
            Frosina works with a ski shop and ski school in Bansko. Tell us what you need and she sends your reservation to
            the shop, so everything is ready when you arrive. Nothing is paid here: you pay the shop in Bansko.
          </p>
          <p>
            Booking Villa Kaja on this site? You can also add skis and lessons at checkout.
          </p>
        </div>
        <RentalReserve />
      </main>
      <Footer />
    </div>
  );
}
