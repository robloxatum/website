import type { Metadata, Viewport } from "next";
import { Bungee, Rubik } from "next/font/google";
import "./globals.css";

const bungee = Bungee({ weight: "400", subsets: ["latin"], variable: "--font-bungee" });
const rubik = Rubik({ subsets: ["latin"], variable: "--font-rubik" });

export const metadata: Metadata = {
  title: { default: "Roblox at UM", template: "%s · Roblox at UM" },
  description:
    "Roblox at the University of Michigan: build, script and play together. Upcoming events and meeting check-in.",
};

export const viewport: Viewport = {
  themeColor: "#00274c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bungee.variable} ${rubik.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
