import type { MetadataRoute } from "next";

/** Web app manifest ("Add to Home Screen"). Icons are app/icon.png and app/apple-icon.png. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Roblox at UM",
    short_name: "Roblox at UM",
    description: "Events, check-in and community for Roblox at the University of Michigan.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#061525",
    theme_color: "#061525",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
