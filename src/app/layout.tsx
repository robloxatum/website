import type { Metadata, Viewport } from "next";
import { Montserrat, Rubik } from "next/font/google";
import "./globals.css";

// Montserrat matches the logo; headings use 800, other display text 700.
const montserrat = Montserrat({ weight: ["700", "800"], subsets: ["latin"], variable: "--font-montserrat" });
const rubik = Rubik({ subsets: ["latin"], variable: "--font-rubik" });

const description =
  "Roblox at UM: Build · Create · Connect. A University of Michigan student club for making Roblox games together. Events and meeting check-in.";

export const metadata: Metadata = {
  // Absolute URLs for the social preview image (opengraph-image.png).
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
  themeColor: "#081f40",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${rubik.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
