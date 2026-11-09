import { Header } from "@/components/Header";
import { UnsubscribeButton } from "@/components/Unsubscribe";
import { readUnsubscribeToken } from "@/lib/marketing";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const email = readUnsubscribeToken(t);
  return (
    <div className="checkout-page">
      <Header sections={false} />
      <main className="checkout host" id="top">
        <div className="success-card">
          <p className="eyebrow">Sea &amp; Ski Villas</p>
          <h1>Unsubscribe</h1>
          {email && t ? (
            <>
              <p className="success-lede">
                Stop offers and news by email to <b>{email}</b>?
              </p>
              <UnsubscribeButton token={t} />
            </>
          ) : (
            <p className="success-lede">This link isn’t complete. Reply to the email you received and we’ll remove you straight away.</p>
          )}
          <p className="checkout-fine" style={{ textAlign: "left", marginTop: 18 }}>
            See our <a href="/privacy">privacy notice</a> for how we handle your details.
          </p>
        </div>
      </main>
    </div>
  );
}
