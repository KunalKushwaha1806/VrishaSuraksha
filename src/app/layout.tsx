import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const noto = Noto_Sans({ subsets: ["latin"], variable: "--font-noto", display: "swap" });
const notoDeva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-deva",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "VridhaSuraksha", template: "%s · VridhaSuraksha" },
  description: "Elder-centred medication and care management. Dadaji stays in charge. The family stays in the loop.",
  applicationName: "VridhaSuraksha",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffaf3" },
    { media: "(prefers-color-scheme: dark)", color: "#161210" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the per-request nonce opts every page into dynamic rendering, so
  // Next.js can stamp the nonce onto its scripts and the strict CSP holds.
  await headers();
  return (
    <html lang="en" className={`${noto.variable} ${notoDeva.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-3 focus:text-ink"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
