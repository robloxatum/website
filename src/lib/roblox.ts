import "server-only";
import { cacheLife } from "next/cache";

/**
 * Roblox's public, unauthenticated APIs: username → user ID, and user ID →
 * current avatar headshot URL (on *.rbxcdn.com). We never store the image.
 *
 * Roblox being slow, down or rate-limiting must never break a page: every
 * call has a short timeout and failures come back as "unavailable" / no
 * avatar, so callers fall back to the initial-letter icon.
 */

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;
const TIMEOUT_MS = 3000;
/** Both APIs accept up to 100 users per request. */
const BATCH = 100;

export type RobloxUser = { id: number; name: string; displayName: string };
export type RobloxLookup =
  | { status: "found"; user: RobloxUser }
  | { status: "not_found" }
  | { status: "unavailable" };

class RobloxUnavailable extends Error {}

async function robloxFetch(url: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new RobloxUnavailable("network");
  }
  // 429 = rate-limited; 5xx = down. Either way: try again later.
  if (!res.ok) throw new RobloxUnavailable(String(res.status));
  try {
    return (await res.json()) as { data?: unknown[] };
  } catch {
    throw new RobloxUnavailable("bad json");
  }
}

/** Short cache for failures, so a Roblox outage is retried soon but not on every request. */
function cacheFailure() {
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
}

/** username (lowercase) → user, for up to 100 usernames. Unknown names are left out. */
async function lookupBatch(usernames: string[]): Promise<Map<string, RobloxUser>> {
  const json = await robloxFetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ usernames, excludeBannedUsers: true }),
  });
  const out = new Map<string, RobloxUser>();
  for (const row of (json.data ?? []) as { requestedUsername?: string; id?: number; name?: string; displayName?: string }[]) {
    if (typeof row.id === "number" && row.id > 0 && row.requestedUsername) {
      out.set(row.requestedUsername.toLowerCase(), { id: row.id, name: row.name ?? "", displayName: row.displayName ?? "" });
    }
  }
  return out;
}

/** Look up one username (cached for about an hour; failures for a minute). */
export async function lookupRobloxUser(username: string): Promise<RobloxLookup> {
  "use cache";
  if (!USERNAME.test(username)) {
    cacheLife("hours");
    return { status: "not_found" };
  }
  try {
    const user = (await lookupBatch([username])).get(username.toLowerCase());
    cacheLife("hours");
    return user ? { status: "found", user } : { status: "not_found" };
  } catch {
    cacheFailure();
    return { status: "unavailable" };
  }
}

/** user ID → headshot URL for a sorted batch of up to 100 IDs. Cached about an hour. */
async function headshotBatch(ids: number[]): Promise<Record<number, string>> {
  "use cache";
  try {
    const json = await robloxFetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids.join(",")}&size=150x150&format=Webp&isCircular=false`,
    );
    const out: Record<number, string> = {};
    let pending = false;
    for (const row of (json.data ?? []) as { targetId?: number; state?: string; imageUrl?: string }[]) {
      if (row.state === "Completed" && typeof row.targetId === "number" && isRobloxCdnUrl(row.imageUrl)) {
        out[row.targetId] = row.imageUrl;
      } else if (row.state === "Pending") {
        pending = true; // Roblox is still rendering it: check again soon.
      }
    }
    if (pending) cacheFailure();
    else cacheLife("hours");
    return out;
  } catch {
    cacheFailure();
    return {};
  }
}

/** username batch → IDs, cached like lookups (used for members saved before IDs were stored). */
async function idsForUsernames(usernames: string[]): Promise<Record<string, number>> {
  "use cache";
  try {
    const found = await lookupBatch(usernames);
    cacheLife("hours");
    return Object.fromEntries([...found].map(([name, user]) => [name, user.id]));
  } catch {
    cacheFailure();
    return {};
  }
}

export function isRobloxCdnUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "rbxcdn.com" || u.hostname.endsWith(".rbxcdn.com"));
  } catch {
    return false;
  }
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH) out.push(items.slice(i, i + BATCH));
  return out;
}

type AvatarSource = { roblox_user_id?: number | null; roblox_username?: string | null };

/**
 * Current headshot URL for each person (null when they have no Roblox
 * username, it can't be found, or Roblox is unavailable), in input order.
 * Uses the stored user ID; for anyone saved before IDs existed, looks the ID
 * up from the username (not stored: only the member can update their profile).
 */
export async function headshotsFor(people: AvatarSource[]): Promise<(string | null)[]> {
  try {
    const missing = [
      ...new Set(
        people
          .filter((p) => !p.roblox_user_id && p.roblox_username && USERNAME.test(p.roblox_username))
          .map((p) => p.roblox_username!.toLowerCase()),
      ),
    ].sort();
    const looked: Record<string, number> = {};
    for (const batch of await Promise.all(chunks(missing).map(idsForUsernames))) Object.assign(looked, batch);

    const idOf = (p: AvatarSource) =>
      p.roblox_user_id || (p.roblox_username ? looked[p.roblox_username.toLowerCase()] : undefined) || null;

    // Sorted, so the same people always make the same cached batches.
    const ids = [...new Set(people.map(idOf).filter((id): id is number => !!id))].sort((a, b) => a - b);
    const urls: Record<number, string> = {};
    for (const batch of await Promise.all(chunks(ids).map(headshotBatch))) Object.assign(urls, batch);

    return people.map((p) => {
      const id = idOf(p);
      return (id && urls[id]) || null;
    });
  } catch (err) {
    console.error("Roblox avatars unavailable", err);
    return people.map(() => null);
  }
}

export async function headshotFor(person: AvatarSource): Promise<string | null> {
  return (await headshotsFor([person]))[0];
}
