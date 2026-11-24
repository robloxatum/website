// Live game links (Roblox private server links). No runtime imports: the unit
// tests run this file directly with Node.

export const GAME_LINK_MAX = 500;
export const GAME_LABEL_MAX = 60;

export type GameLink = { url: string; label: string | null };

/**
 * Checks and normalizes an officer-pasted link: https only, host roblox.com
 * or www.roblox.com (no look-alikes, no credentials, no other ports). Returns
 * the cleaned URL or a friendly error. The database enforces the same rule.
 */
export function normalizeGameLink(raw: string): { url: string } | { error: string } {
  const text = raw.trim();
  if (!text) return { error: "Paste the Roblox private server link." };
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return { error: "That doesn't look like a link. Copy it from Roblox and paste it here." };
  }
  const host = u.hostname.toLowerCase();
  if (host !== "roblox.com" && host !== "www.roblox.com") {
    return { error: "Only roblox.com links can be posted." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { error: "Only roblox.com links can be posted." };
  if (u.username || u.password || u.port) return { error: "Only roblox.com links can be posted." };
  // Always https, keep the path and query (the private server code), drop the fragment.
  const url = `https://${host}${u.pathname}${u.search}`;
  if (url.length > GAME_LINK_MAX) return { error: "That link is too long." };
  if (/[\s"'<>\\]/.test(url)) return { error: "That link has characters Roblox links don't use." };
  return { url };
}

export function normalizeGameLabel(raw: string): { label: string | null } | { error: string } {
  const label = raw.trim().replace(/\s+/g, " ");
  if (!label) return { label: null };
  if (label.length > GAME_LABEL_MAX) return { error: `Keep the label under ${GAME_LABEL_MAX} characters.` };
  return { label };
}
