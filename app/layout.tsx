import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session/SessionProvider";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { CustomCursor } from "@/components/motion/CustomCursor";
import { BRAND } from "@/lib/theme/tokens";

// Davinci substitute — a dramatic editorial serif for the display/headings.
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description:
    "Peer-to-peer file sharing in your browser. Drop a file, scan a code, and it lands on any device — iPhone, Android, Windows, Mac. No installs, no accounts, end-to-end encrypted.",
  applicationName: BRAND.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: BRAND.name },
  // Favicons are provided by the file-based convention (app/icon.svg, app/apple-icon.png),
  // which Next serves with a content hash so browsers can't keep serving a stale icon.
};

export const viewport: Viewport = {
  themeColor: "#c4c3b6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        {/* SessionProvider lives above the router outlet so the live WebRTC connection
            survives navigation between /send, /receive and /transfer. */}
        <SessionProvider>{children}</SessionProvider>
        <CustomCursor />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
