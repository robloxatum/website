import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OfficerEvent } from "@/lib/types";

export const OFFICER_EVENT_COLUMNS =
  "id, title, description, location, starts_at, ends_at, category, capacity, flyer_path, flyer_width, flyer_height, cover_path, cover_width, cover_height, checkin_open, checkin_reopened, checkin_is_open";

export type OfficerEventWithCount = OfficerEvent & { attendance: { count: number }[] };

export async function getOfficerEvents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(`${OFFICER_EVENT_COLUMNS}, attendance(count)`)
    .order("starts_at", { ascending: false })
    .returns<OfficerEventWithCount[]>();
  if (error) console.error("Failed to load officer events", error.message);
  return data ?? [];
}

export async function getOfficerEvent(id: string) {
  const supabase = await createClient();
  const [{ data: event }, { data: code }] = await Promise.all([
    supabase.from("events").select(OFFICER_EVENT_COLUMNS).eq("id", id).maybeSingle<OfficerEvent>(),
    supabase.from("event_codes").select("code").eq("event_id", id).maybeSingle<{ code: string }>(),
  ]);
  return event ? { event, code: code?.code ?? null } : null;
}

export type AttendeeRow = {
  user_id: string;
  checked_in_at: string;
  profiles: { full_name: string; uniqname: string; roblox_username: string | null; roblox_user_id: number | null } | null;
};

export async function getAttendees(eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("user_id, checked_in_at, profiles(full_name, uniqname, roblox_username, roblox_user_id)")
    .eq("event_id", eventId)
    .order("checked_in_at", { ascending: true })
    .returns<AttendeeRow[]>();
  if (error) console.error("Failed to load attendance", error.message);
  return data ?? [];
}

/** Totals for the dashboard summary cards (officer RLS: officers can count all rows). */
export async function getOfficerTotals() {
  const supabase = await createClient();
  const [{ count: members }, { count: checkins }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("attendance").select("*", { count: "exact", head: true }),
  ]);
  return { members: members ?? 0, checkins: checkins ?? 0 };
}

/** The event's live game link (officers can always read it; RLS). */
export async function getGameLink(eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_game_links")
    .select("url, label")
    .eq("event_id", eventId)
    .maybeSingle<{ url: string; label: string | null }>();
  if (error) console.error("Failed to load game link", error.message);
  return data ?? null;
}
