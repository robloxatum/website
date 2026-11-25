import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { WebAnalytics } from "@/components/site/WebAnalytics";
import { InstallableApp } from "@/components/site/InstallableApp";
import { splashImages } from "@/lib/app-install";
import { SITE_NAME, siteUrl } from "@/lib/metadata";
import "./globals.css";

// Montserrat matches the logo (display); Inter for body, nav, forms and buttons.
const montserrat = Montserrat({ weight: ["700", "800"], subsets: ["latin"], variable: "--font-montserrat" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const description =
  "A student-led community for Roblox creators, players, and developers at U-M. Build · Create · Connect.";

export const metadata: Metadata = {
  // Absolute URLs for the social preview images (opengraph-image.png).
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description,
  applicationName: SITE_NAME,
  // Home-screen app on iPhone: full screen under a see-through status bar (the
  // header pads for it), with a launch screen per iPhone size.
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent", startupImage: splashImages() },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description },
};

export const viewport: Viewport = {
  themeColor: "#061525",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable}`}>
      <body className="min-h-dvh">
        {children}
        <InstallableApp />
        {/* Vercel only: the analytics script doesn't exist on localhost. */}
        {process.env.VERCEL && <WebAnalytics />}
      </body>
    </html>
  );
}
