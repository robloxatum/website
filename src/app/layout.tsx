import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { WebAnalytics } from "@/components/site/WebAnalytics";
import "./globals.css";

// Montserrat matches the logo (display); Inter for body, nav, forms and buttons.
const montserrat = Montserrat({ weight: ["700", "800"], subsets: ["latin"], variable: "--font-montserrat" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const description =
  "A student-led community for Roblox creators, players, and developers at U-M. Build · Create · Connect.";

export const metadata: Metadata = {
  // Absolute URLs for the social preview images (opengraph-image.png).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "Roblox at UM", template: "%s · Roblox at UM" },
  description,
  openGraph: {
    type: "website",
    siteName: "Roblox at UM",
    title: "Roblox at UM",
    description,
  },
  twitter: { card: "summary_large_image", title: "Roblox at UM", description },
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
        <WebAnalytics />
      </body>
    </html>
  );
}
