// Announcement banner rules. No runtime imports: the unit tests run this file
// directly with Node. The database enforces the same limits.

export const ANNOUNCEMENT_MAX = 140;

export type AnnouncementStyle = "info" | "urgent";

export type Announcement = {
  id: string;
  message: string;
  link: string | null;
  style: AnnouncementStyle;
  hide_after: string | null;
};

export function normalizeMessage(raw: string): { message: string } | { error: string } {
  const message = raw.trim().replace(/\s+/g, " ");
  if (!message) return { error: "Write the announcement." };
  if (message.length > ANNOUNCEMENT_MAX) return { error: `Keep it to ${ANNOUNCEMENT_MAX} characters (it's ${message.length}).` };
  // Same rule as the site content editor: it's shown as text, so tags would show up literally.
  if (LOOKS_LIKE_HTML.test(message)) return { error: "Write it as plain text only, no HTML." };
  return { message };
}

const ALLOWED = /(^|\.)(roblox\.com|umich\.edu)$/;
const LOOKS_LIKE_HTML = /<[A-Za-z/!?]/;
const BAD_CHARS = /[\s"'<>\\]/;

/**
 * Optional link: a path on our own site ("/events", or a full URL on our own
 * domain, stored as its path so it survives a domain change), or an https link
 * on roblox.com / umich.edu (or their subdomains).
 */
/** A path on this site, also after dot segments resolve ("/..//x" would become "//x", another host). */
function isSamePath(path: string) {
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

export function normalizeLink(raw: string, siteHosts: readonly string[]): { link: string | null } | { error: string } {
  const text = raw.trim();
  if (!text) return { link: null };
  const tooLong = { error: "That link is too long." };
  const notAllowed = { error: "Links can go to our own site, roblox.com or umich.edu." };

  if (text.startsWith("/")) {
    if (!isSamePath(text)) return notAllowed;
    if (BAD_CHARS.test(text)) return { error: "That link has spaces or characters links can't use." };
    return text.length > 500 ? tooLong : { link: text };
  }

  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return { error: "That doesn't look like a link." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return notAllowed;
  if (u.username || u.password || u.port) return notAllowed;
  const host = u.hostname.toLowerCase();

  if (siteHosts.map((h) => h.toLowerCase()).includes(host)) {
    const path = `${u.pathname}${u.search}${u.hash}` || "/";
    return BAD_CHARS.test(path) || path.length > 500 || !isSamePath(path) ? notAllowed : { link: path };
  }
  if (!ALLOWED.test(host)) return notAllowed;
  const link = `https://${host}${u.pathname === "/" && !u.search ? "" : u.pathname}${u.search}${u.hash}`;
  if (BAD_CHARS.test(link)) return { error: "That link has spaces or characters links can't use." };
  return link.length > 500 ? tooLong : { link };
}

/** Same per-announcement key everywhere, so a NEW announcement shows again after a dismiss. */
export function dismissKey(id: string) {
  return `announcement-dismissed:${id}`;
}

export function isExternal(link: string) {
  return !link.startsWith("/");
}
