// What a flyer QR code links to, and how those visits show up in Vercel
// Analytics. No runtime imports: the unit tests run this file directly with Node.

const EVENT_PATH =
  /^\/events\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A flyer label: lowercase letters, numbers, - and _ (max 48). "Diag Board!" → "diag-board". */
export function sanitizeLabel(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
    .replace(/^-+|-+$/g, "");
}

const trim = (base: string) => base.replace(/\/$/, "");

/** The Join page, with an optional label: <base>/join?src=<label>. */
export function joinUrl(base: string, label: string) {
  return `${trim(base)}/join${label ? `?src=${label}` : ""}`;
}

/** One event's public page, with an optional label: <base>/events/<id>?src=<label>. */
export function eventUrl(base: string, eventId: string, label: string) {
  return `${trim(base)}/events/${eventId}${label ? `?src=${label}` : ""}`;
}

/** A short link: <base>/go/<slug>. */
export function shortlinkUrl(base: string, slug: string) {
  return `${trim(base)}/go/${slug}`;
}

/**
 * The path a visit is reported as. A labelled visit to /join or to an event
 * page gets its label folded into the path (/join?src=x → /join/src/x,
 * /events/<id>?src=x → /events/<id>/src/x), so each flyer is its own row in
 * the free "Pages" report. Anything else: the path as is.
 */
export function trackedPath(pathname: string, src: string | null) {
  const tracked = pathname === "/join" || EVENT_PATH.test(pathname);
  const label =
    tracked && src
      ? src
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 48)
      : "";
  return label ? `${pathname}/src/${label}` : pathname;
}

/** trackedPath for a site path like "/join?src=x". */
export function analyticsPath(path: string) {
  const u = new URL(path, "https://x.invalid");
  return trackedPath(u.pathname, u.searchParams.get("src"));
}
