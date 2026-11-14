import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

const baseUrl = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "EstateFlow · Visitor passes and estate dues for Nigerian estates",
    template: "%s · EstateFlow",
  },
  description:
    "EstateFlow gives gated estates in Nigeria verified visitor passes at the gate, service charge invoices with trustworthy receipts, and a ledger residents can read.",
  applicationName: "EstateFlow",
  openGraph: {
    type: "website",
    siteName: "EstateFlow",
    locale: "en_NG",
    title: "EstateFlow · The estate, under control",
    description: "Visitor passes in seconds, verified dues payments, and a ledger every resident can read.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EstateFlow · The estate, under control",
    description: "Visitor passes in seconds, verified dues payments, and a ledger every resident can read.",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#101b35",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-navy button-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
