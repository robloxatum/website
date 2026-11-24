import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Announcement } from "./announcement";
import { createPublicClient } from "./supabase/public";

const COLUMNS = "id, message, link, style, hide_after";

/**
 * The active announcement for the public banner (anon read; RLS hides it after
 * its hide-after time). Cached for a minute and refreshed immediately when an
 * officer publishes or clears (cache tag "announcement"); the banner also
 * hides itself at hide_after.
 */
export async function getActiveAnnouncement(): Promise<Announcement | null> {
  "use cache";
  cacheTag("announcement");
  cacheLife("minutes");
  const { data, error } = await createPublicClient()
    .from("announcements")
    .select(COLUMNS)
    .maybeSingle<Announcement>();
  if (error) console.error("Failed to load announcement", error.message);
  return data ?? null;
}
