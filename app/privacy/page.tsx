import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { brand } from "@/lib/brand";
import { MARKETING_LINE } from "@/lib/marketing";
import { businessDetails } from "@/lib/site-config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How Sea & Ski Villas handles your personal details when you book, ask a question or leave a review.",
};

const UPDATED = "9 November 2026";

/**
 * Privacy notice (GDPR art. 13). Keep it in step with what the site actually does:
 * retention periods here are enforced by tidyDb() in lib/db.ts.
 * Have it checked by a local lawyer or accountant before relying on it.
 */
export default function PrivacyPage() {
  const biz = businessDetails();
  const controller = [biz.legalName || `${brand.host}, host of ${brand.name}`, biz.address].filter(Boolean).join(", ");
  return (
    <div className="checkout-page">
      <Header sections={false} />
      <main className="checkout legal" id="top">
        <p className="eyebrow">{brand.name}</p>
        <h1>Privacy notice</h1>
        <p className="legal-updated">Last updated {UPDATED}</p>

        <section>
          <h2>Who we are</h2>
          <p>
            {brand.name} lets two holiday houses: Villa Kaja in Bansko, Bulgaria, and Jani’s Beach House in Neoi Epivates, Greece. The
            controller of your personal data is {controller}. Contact us about anything on this page at{" "}
            <a href={`mailto:${biz.email}`}>{biz.email}</a>.
          </p>
        </section>

        <section>
          <h2>What we collect and why</h2>
          <table className="legal-table">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Why, and the legal basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>You book a stay</td>
                <td>Name, email, phone, arrival time, your message, dates, number of guests, prices and payment status</td>
                <td>To take and manage your booking and stay (contract), and to keep accounting records (legal obligation)</td>
              </tr>
              <tr>
                <td>You pay the deposit</td>
                <td>Card payment is handled by Stripe. We see the amount, the payment status and the card type with its last four digits; we never see your full card number</td>
                <td>To take payment and refund it if needed (contract)</td>
              </tr>
              <tr>
                <td>You arrive</td>
                <td>Identity details the local guest-registration rules ask for</td>
                <td>To register guests with the authorities as the law requires (legal obligation)</td>
              </tr>
              <tr>
                <td>You ask a question on the website</td>
                <td>Name, email and your question</td>
                <td>To answer you (steps before a contract, or our legitimate interest in replying)</td>
              </tr>
              <tr>
                <td>You review your stay</td>
                <td>Your first name, rating, text and the month you stayed</td>
                <td>To show reviews to future guests, only after we approve them (your consent when you submit it)</td>
              </tr>
              <tr>
                <td>You tick the offers box at checkout</td>
                <td>Your email and when you agreed</td>
                <td>To email you occasional offers and news (your consent). The box is optional and unticked; booking never depends on it</td>
              </tr>
              <tr>
                <td>You use the website</td>
                <td>Your IP address, for a short time</td>
                <td>To stop spam and payment fraud (legitimate interest)</td>
              </tr>
            </tbody>
          </table>
          <p>
            We don’t use advertising or analytics trackers, and the site sets no cookies for visitors. We never sell your details or
            share them for others’ marketing.
          </p>
        </section>

        <section>
          <h2>Who we share it with</h2>
          <ul>
            <li>Stripe, which processes card payments and refunds.</li>
            <li>Vercel, which hosts the website, and Neon, which hosts our booking database.</li>
            <li>Our email provider, to send booking emails and replies.</li>
            <li>OpenStreetMap, which shows the map on the house pages (your browser loads it from them).</li>
            <li>Our accountant and public authorities, when the law requires it (for example tax and guest registration).</li>
          </ul>
          <p>
            Some of these companies may process data outside the European Economic Area. When they do, they use the safeguards GDPR
            requires, such as the EU Standard Contractual Clauses.
          </p>
        </section>

        <section>
          <h2>How long we keep it</h2>
          <ul>
            <li>Bookings and payment records: for as long as tax and accounting law requires us to keep them.</li>
            <li>Checkouts that were started but never paid: deleted after 30 days.</li>
            <li>Questions sent from the website: deleted after 2 years.</li>
            <li>Your agreement to receive offers: until you unsubscribe. After that we only keep a note that you unsubscribed, so we don’t email you again.</li>
            <li>Reviews: while they are on the website, or until you ask us to remove them.</li>
            <li>IP addresses used against spam and fraud: deleted after 2 days.</li>
          </ul>
        </section>

        <section>
          <h2>Offers by email</h2>
          <p>
            At checkout you can tick: “{MARKETING_LINE}” If you do, we may email you now and then. Every offer email has an unsubscribe
            link, or you can simply reply and ask. Unsubscribing doesn’t affect emails about a stay you’ve booked.
          </p>
        </section>

        <section>
          <h2>Your rights</h2>
          <p>
            You can ask us for a copy of your data, to correct it, to delete it, to limit how we use it, or to send it to you in a common
            format. You can object to uses based on our legitimate interest and withdraw consent at any time. Some records, like
            payment records, we must keep by law even if you ask us to delete them; we’ll tell you if that applies. Write to{" "}
            <a href={`mailto:${biz.email}`}>{biz.email}</a> and we’ll reply within one month.
          </p>
          <p>
            You can also complain to a data protection authority: in Bulgaria the Commission for Personal Data Protection (cpdp.bg), in
            Greece the Hellenic Data Protection Authority (dpa.gr), or the authority where you live.
          </p>
        </section>

        <section>
          <h2>Bookings on Airbnb and Booking.com</h2>
          <p>
            If you book through Airbnb or Booking.com, that platform’s privacy policy covers what you give them. We use the details they
            pass on to us only to host your stay.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
