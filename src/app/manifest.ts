import type { MetadataRoute } from "next";

/**
 * Web app manifest: the installed ("Add to Home Screen") app. Icons and the
 * iPhone splash screens come from scripts/make-app-icons.py; Android draws its
 * own splash from the name, background_color and the 512px icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Roblox at UM",
    short_name: "Roblox at UM",
    description: "Events, check-in and community for Roblox at the University of Michigan.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone"],
    orientation: "any",
    background_color: "#061525",
    theme_color: "#061525",
    categories: ["social", "games", "education"],
    icons: [
      { src: "/icons/v2/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/v2/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/v2/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/v2/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the home-screen icon (Android).
    shortcuts: [
      { name: "Check In", short_name: "Check In", url: "/checkin?source=app", icons: [{ src: "/icons/v2/icon-192.png", sizes: "192x192" }] },
      { name: "Events", short_name: "Events", url: "/events?source=app", icons: [{ src: "/icons/v2/icon-192.png", sizes: "192x192" }] },
      { name: "Play", short_name: "Play", url: "/play?source=app", icons: [{ src: "/icons/v2/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
