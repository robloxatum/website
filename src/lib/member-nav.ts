import "server-only";
import { cache } from "react";
import { getProfile } from "./auth";
import { createClient } from "./supabase/server";

/** An event the member is checked in to that hasn't ended. Times only: never the game link. */
export type CheckedInEvent = { id: string; starts_at: string; ends_at: string };

export type MemberNav = { member: boolean; checkedIn: CheckedInEvent[] };

/**
 * What the nav needs to know about the visitor, once per request: signed-in
 * member or not, and the events they're checked in to that haven't ended (the
 * browser works out which one is live right now and keeps it up to date).
 */
export const getMemberNav = cache(async (): Promise<MemberNav> => {
  const profile = await getProfile(); // request-time (reads the session)
  if (!profile) return { member: false, checkedIn: [] };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("events!inner(id, starts_at, ends_at)")
    .eq("user_id", profile.id)
    .gt("events.ends_at", new Date().toISOString())
    .returns<{ events: CheckedInEvent | null }[]>();
  if (error) console.error("Failed to load check-ins for the nav", error.message);
  const checkedIn = (data ?? [])
    .map((r) => r.events)
    .filter((e): e is CheckedInEvent => !!e)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return { member: true, checkedIn };
});
