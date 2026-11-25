// No runtime imports: the unit tests run this file directly with Node.
import type { ShortLink } from "@/content/shortlinks";

export const SHORTLINK_FALLBACK = "/";

/**
 * Only same-site paths ("/x"), never "//host" or "/\host" (open redirects),
 * including after dot segments are resolved ("/..//host" becomes "//host").
 */
export function isSitePath(path: string) {
  const notHost = (p: string) => p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\");
  if (!notHost(path)) return false;
  try {
    const base = "http://local.invalid";
    const url = new URL(path, base);
    return url.origin === base && notHost(url.pathname);
  } catch {
    return false;
  }
}

export function findShortlink(links: readonly ShortLink[], slug: string) {
  const key = slug.trim().toLowerCase();
  return links.find((l) => l.slug === key) ?? null;
}

/** An unparseable expiry counts as expired, so a typo never keeps an old link alive. */
export function isShortlinkExpired(link: ShortLink, now: Date) {
  const expires = Date.parse(link.expiresAt);
  return !Number.isFinite(expires) || now.getTime() >= expires;
}

/** Where /go/<slug> sends someone at `now`. Always a same-site path. */
export function resolveShortlink(links: readonly ShortLink[], slug: string, now: Date) {
  const link = findShortlink(links, slug);
  if (!link) return SHORTLINK_FALLBACK;
  const path = isShortlinkExpired(link, now) ? link.afterExpiry : link.target;
  return isSitePath(path) ? path : SHORTLINK_FALLBACK;
}

/**
 * The redirect for /go/... at `now`: always a 307 (temporary) with no-store, so
 * neither browsers nor the CDN keep sending people to the pre-expiry target.
 * `segments` is the catch-all route param; anything but exactly one segment goes home.
 */
export function shortlinkRedirect(
  links: readonly ShortLink[],
  segments: readonly string[] | undefined,
  now: Date,
  requestUrl: string,
) {
  let path = SHORTLINK_FALLBACK;
  try {
    if (segments?.length === 1) path = resolveShortlink(links, segments[0], now);
  } catch {
    path = SHORTLINK_FALLBACK;
  }
  return new Response(null, {
    status: 307,
    headers: {
      Location: new URL(path, requestUrl).toString(),
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
