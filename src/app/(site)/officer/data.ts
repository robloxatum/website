import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OfficerEvent } from "@/lib/types";

export const OFFICER_EVENT_COLUMNS =
  "id, title, description, location, starts_at, ends_at, checkin_open, checkin_reopened, checkin_is_open";

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
  profiles: { full_name: string; uniqname: string; roblox_username: string | null } | null;
};

export async function getAttendees(eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("user_id, checked_in_at, profiles(full_name, uniqname, roblox_username)")
    .eq("event_id", eventId)
    .order("checked_in_at", { ascending: true })
    .returns<AttendeeRow[]>();
  if (error) console.error("Failed to load attendance", error.message);
  return data ?? [];
}
