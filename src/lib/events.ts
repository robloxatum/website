import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "./supabase/public";
import type { PublicEvent } from "./types";

const PUBLIC_COLUMNS = "id, title, description, location, starts_at, ends_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** All events, split into upcoming (not yet ended) and past. Cached; officers' edits refresh it. */
export async function getEventLists(): Promise<{ upcoming: PublicEvent[]; past: PublicEvent[] }> {
  "use cache";
  cacheTag("events");
  cacheLife("minutes");

  const { data, error } = await createPublicClient()
    .from("events")
    .select(PUBLIC_COLUMNS)
    .order("starts_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Failed to load events", error.message);
    return { upcoming: [], past: [] };
  }

  const now = Date.now();
  const events = (data ?? []) as PublicEvent[];
  return {
    upcoming: events.filter((e) => new Date(e.ends_at).getTime() > now),
    past: events.filter((e) => new Date(e.ends_at).getTime() <= now).reverse(),
  };
}

export async function getPublicEvent(id: string): Promise<PublicEvent | null> {
  "use cache";
  cacheTag("events");
  cacheLife("minutes");

  if (!UUID.test(id)) return null;
  const { data, error } = await createPublicClient()
    .from("events")
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .maybeSingle<PublicEvent>();
  if (error) console.error("Failed to load event", error.message);
  return data ?? null;
}

export function isUuid(id: string) {
  return UUID.test(id);
}
