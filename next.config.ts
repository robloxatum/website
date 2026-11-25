import { join } from "node:path";
import type { NextConfig } from "next";
import { readCoverManifest } from "./src/lib/cover-manifest";

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
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";

/**
 * Content Security Policy. 'unsafe-inline' scripts are needed because pages
 * are prerendered (Partial Prerendering) with Next's inline bootstrap scripts;
 * nonces would force every page to render per request. The rest is strict:
 * no embedding (frame-ancestors), no plugins, no <base> or off-site form
 * targets, and the browser only talks to this site and our Supabase project.
 */
const isDev = process.env.NODE_ENV === "development";
const isPreview = process.env.VERCEL_ENV === "preview"; // Vercel's preview toolbar
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${isPreview ? " https://vercel.live" : ""}`,
  `style-src 'self' 'unsafe-inline'${isPreview ? " https://vercel.live" : ""}`,
  `img-src 'self' data: blob: https://*.rbxcdn.com ${supabaseOrigin}${isPreview ? " https://vercel.live https://vercel.com" : ""}`,
  `font-src 'self'${isPreview ? " https://vercel.live https://assets.vercel.com" : ""}`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^http/, "ws")}${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}${isPreview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
  `frame-src ${isPreview ? "https://vercel.live" : "'none'"}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ");
const flyerImages = supabaseUrl ? [new URL(`${supabaseUrl}/storage/v1/object/public/event-flyers/**`)] : [];
// Members' Roblox avatar headshots (URLs come from Roblox's thumbnails API).
const robloxImages = [{ protocol: "https" as const, hostname: "**.rbxcdn.com", pathname: "/**" }];

// Default event covers: whatever images are in public/art/covers at build time
// (restart `next dev` after adding one). Inlined as process.env.DEFAULT_COVERS.
const defaultCovers = readCoverManifest(join(process.cwd(), "public", "art", "covers"));

const nextConfig: NextConfig = {
  env: { DEFAULT_COVERS: JSON.stringify(defaultCovers) },
  cacheComponents: true,
  partialPrefetching: true,
  // AVIF first (smallest), WebP for browsers without AVIF. 75 is the default
  // quality; 50 is left in for art that compresses well at lower quality.
  // Flyers come from the public Supabase Storage bucket; avatars from Roblox's CDN.
  images: { formats: ["image/avif", "image/webp"], qualities: [50, 75], remotePatterns: [...flyerImages, ...robloxImages] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: [...securityHeaders, { key: "Content-Security-Policy", value: csp }] }];
  },
};

export default nextConfig;
