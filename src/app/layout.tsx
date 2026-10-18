import type { Metadata, Viewport } from "next";
import { Spectral, IBM_Plex_Sans } from "next/font/google";
import "@/styles/globals.css";
import { SITE } from "@/lib/site";
import { Analytics } from "@vercel/analytics/react";

const serif = Spectral({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--serif",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name}: methodology flowchart maker for theses and research`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.desc,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    url: SITE.url,
    title: `${SITE.name}: ${SITE.tagline}`,
    description: SITE.desc,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE.tagline }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name}: ${SITE.tagline}`,
    description: SITE.desc,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
  verification: process.env.NEXT_PUBLIC_GSC_TOKEN
    ? { google: process.env.NEXT_PUBLIC_GSC_TOKEN }
    : undefined,
};

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}