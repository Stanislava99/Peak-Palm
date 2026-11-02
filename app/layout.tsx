import { brand } from "@/lib/brand";
import { getSiteUrl, isPreviewDeployment } from "@/lib/site";
import { appEnv } from "@/lib/site-config";
import type { Metadata, Viewport } from "next";
import "@fontsource/cinzel/500.css";
import "@fontsource-variable/cormorant-garamond/wght.css";
import "@fontsource-variable/cormorant-garamond/wght-italic.css";
import "@fontsource-variable/jost/wght.css";
import "./globals.css";

const description =
  "Peak & Palm Villas: two private holiday houses from one host. Villa Kaja is a chalet in Bansko, Bulgaria, by the gondola. Jani’s Beach House is in Neoi Epivates, Greece, about 30 metres from the beach.";

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
  themeColor: brand.colors.pine,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {appEnv() === "test" ? (
          <div className="test-badge" role="note">
            <b>TEST SITE</b> · Stripe test mode, no real charges · card 4242 4242 4242 4242
          </div>
        ) : null}
      </body>
    </html>
  );
}
