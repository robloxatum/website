import type { Metadata } from "next";
import type { EventCoverImage } from "./types";

export const SITE_NAME = "Roblox at UM";

/** app/opengraph-image.png (1200×630). */
const DEFAULT_IMAGE = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "Roblox at UM: Build · Create · Connect" };

/** The site's own address, for absolute links in previews (Vercel previews use their own URL). */
export function siteUrl() {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/**
 * Title, description and the matching Open Graph / Twitter tags for a page,
 * so link previews (iMessage, GroupMe, Discord, Instagram DMs) show this page,
 * not the home page. Images come from opengraph-image.png files unless given.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: { url: string; width: number; height: number; alt: string };
}): Metadata {
  const full = `${title} · ${SITE_NAME}`;
  // A page that sets its own openGraph loses the parent's opengraph-image.png,
  // so fall back to the site image explicitly.
  const images = [image ?? DEFAULT_IMAGE];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, title: full, description, url: path, images },
    twitter: { card: "summary_large_image", title: full, description, images },
  };
}

/**
 * Link-preview image for an event cover. Default covers are WebP, which some
 * apps don't preview, so those use the JPG copy in public/art/covers-og.
 */
export function coverPreviewImage(cover: EventCoverImage | null, title: string) {
  if (!cover) return undefined;
  const alt = `Cover image for ${title}`;
  const fixed = cover.src.match(/^\/art\/covers\/([^/]+)\.webp$/);
  if (fixed) return { url: `/art/covers-og/${fixed[1]}.jpg`, width: 1200, height: 600, alt };
  return { url: cover.src, width: cover.width, height: cover.height, alt };
}
