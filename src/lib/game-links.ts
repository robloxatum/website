// Live game links (Roblox private server links). No runtime imports: the unit
// tests run this file directly with Node.

export const GAME_LINK_MAX = 500;
export const GAME_LABEL_MAX = 60;
/** Most servers one event can have (the database enforces it too). */
export const GAME_SERVERS_MAX = 10;

/** One live Roblox private server for an event, in the officers' order. */
export type GameServer = { id: string; url: string; label: string; is_full: boolean; position: number };

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

/** "Server N" for the next server, N one past the highest "Server N" already used. */
export function defaultServerLabel(existing: readonly { label: string }[]): string {
  let n = existing.length;
  for (const { label } of existing) {
    const m = /^Server (\d+)$/i.exec(label.trim());
    if (m) n = Math.max(n, Number(m[1]));
  }
  return `Server ${n + 1}`;
}

/** Officers' order: position, then oldest first. */
export function sortServers<T extends Pick<GameServer, "position"> & { created_at?: string }>(servers: readonly T[]): T[] {
  return [...servers].sort((a, b) => a.position - b.position || (a.created_at ?? "").localeCompare(b.created_at ?? ""));
}

/** The ids in order with `id` moved one place up (-1) or down (+1); unchanged at the ends. */
export function moveId(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const out = [...ids];
  const i = out.indexOf(id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/**
 * "Suggested for you": spreads members evenly over the servers that aren't
 * full, by check-in order (1st → first open server, 2nd → second, … wrapping
 * around). Null when there's no real choice to make (fewer than two open
 * servers) or no check-in order.
 */
export function suggestServer<T extends Pick<GameServer, "id" | "is_full">>(servers: readonly T[], checkinOrder: number | null): T | null {
  const open = servers.filter((s) => !s.is_full);
  if (open.length < 2 || checkinOrder == null || !(checkinOrder >= 1)) return null;
  return open[(Math.floor(checkinOrder) - 1) % open.length];
}
