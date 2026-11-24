import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Check-in URLs contain the code; don't leak full URLs to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// Event flyers are served from the public Supabase Storage bucket; allow only that path.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const flyerImages = supabaseUrl ? [new URL(`${supabaseUrl}/storage/v1/object/public/event-flyers/**`)] : [];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // AVIF first (smallest), WebP for browsers without AVIF. 75 is the default
  // quality; 50 is for the hero sketch (light lines on flat navy compress well).
  // Flyers come from the public Supabase Storage bucket.
  images: { formats: ["image/avif", "image/webp"], qualities: [50, 75], remotePatterns: flyerImages },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
