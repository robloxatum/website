import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { withCovers } from "./event-covers";
import { createPublicClient } from "./supabase/public";
import type { EventStatus, ListedEvent, PublicEvent } from "./types";

/** Past-event attendance is only shown publicly once it reaches this. */
export const MIN_PUBLIC_COUNT = 10;

const PUBLIC_COLUMNS =
  "id, title, description, location, starts_at, ends_at, category, capacity, flyer_path, flyer_width, flyer_height, cover_path, cover_width, cover_height, updated_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function eventStatus(e: Pick<PublicEvent, "starts_at" | "ends_at">, now = Date.now()): EventStatus {
  if (new Date(e.ends_at).getTime() <= now) return "completed";
  if (new Date(e.starts_at).getTime() <= now) return "live";
  return "upcoming";
}

/**
 * Aggregate attendance per ENDED event (never live/upcoming), hidden below
 * MIN_PUBLIC_COUNT so small events don't look empty.
 */
async function getPastEventCounts(): Promise<Map<string, number>> {
  const { data, error } = await createPublicClient().rpc("public_past_event_counts");
  if (error) {
    console.error("Failed to load past event counts", error.message);
    return new Map();
  }
  return new Map(
    ((data ?? []) as { event_id: string; attendance: number }[])
      .filter((r) => r.attendance >= MIN_PUBLIC_COUNT)
      .map((r) => [r.event_id, r.attendance]),
  );
}

/**
 * All events, split into upcoming (includes live: not yet ended) and past
 * (newest first). Cached; officers' edits refresh it.
 */
export async function getEventLists(): Promise<{ upcoming: ListedEvent[]; past: ListedEvent[] }> {
  "use cache";
  cacheTag("events");
  cacheLife("minutes");

  const [{ data, error }, counts] = await Promise.all([
    createPublicClient().from("events").select(PUBLIC_COLUMNS).order("starts_at", { ascending: true }).limit(500),
    getPastEventCounts(),
  ]);

  if (error) {
    console.error("Failed to load events", error.message);
    return { upcoming: [], past: [] };
  }

  const now = Date.now();
  const events = ((data ?? []) as PublicEvent[]).map((e) => {
    const status = eventStatus(e, now);
    return { ...e, status, attendance: status === "completed" ? (counts.get(e.id) ?? null) : null };
  });
  // Covers are picked per list, in display order, so neighbouring cards differ.
  return {
    upcoming: withCovers(events.filter((e) => e.status !== "completed")),
    past: withCovers(events.filter((e) => e.status === "completed").reverse()),
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
