import type { MetadataRoute } from "next";

/**
 * /robots.txt: search engines may index the public pages (home, events,
 * about, join, links, privacy) but not the signed-in or officer pages, the
 * sign-in flow or check-in links (they carry the event's code). Preview
 * deployments ask not to be indexed at all. This is a request to well-behaved
 * crawlers, not access control: those pages check who's signed in themselves.
 */
const PRIVATE_PATHS = ["/officer", "/profile", "/welcome", "/checkin", "/play", "/login", "/auth/", "/api/"];

export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === "preview") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS } };
}
