import { brand } from "@/lib/brand";
import { getSiteUrl, isPreviewDeployment } from "@/lib/site";
import { appEnv } from "@/lib/site-config";
import { analyticsWebsiteId } from "@/lib/analytics";
import { Analytics } from "@/components/Analytics";
import { VercelAnalytics } from "@/components/VercelAnalytics";
import type { Metadata, Viewport } from "next";
import { Cinzel, Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";

// next/font self-hosts these, preloads the Latin files and sizes the fallback
// font to match, so text doesn't jump when the web font arrives.
const cinzel = Cinzel({ subsets: ["latin"], weight: "500", variable: "--ff-brand", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--ff-display",
  display: "swap",
});
const jost = Jost({ subsets: ["latin"], variable: "--ff-sans", display: "swap" });

const description =
  "Sea & Ski Villas: two private holiday houses from one host. Villa Kaja is a chalet in Bansko, Bulgaria, by the gondola. Jani’s Beach House is in Neoi Epivates, Greece, about 30 metres from the beach.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${brand.name} · Holiday houses in Bansko and Greece`,
    template: `%s · ${brand.name}`,
  },
  description,
  applicationName: brand.name,
  robots: isPreviewDeployment()
    ? { index: false, follow: false }
    : { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: brand.name,
    title: `${brand.name} · ${brand.tagline}`,
    description,
    url: "/",
    images: [{ url: "/brand/og.jpg", width: 1200, height: 630, alt: `${brand.name}: ${brand.tagline}` }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: brand.colors.navy,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${cormorant.variable} ${jost.variable}`}>
      <body>
        {children}
        <Analytics websiteId={analyticsWebsiteId()} />
        <VercelAnalytics />
        {appEnv() === "test" ? (
          <div className="test-badge" role="note">
            <b>TEST SITE</b> · Stripe test mode, no real charges · card 4242 4242 4242 4242
          </div>
        ) : null}
      </body>
    </html>
  );
}
