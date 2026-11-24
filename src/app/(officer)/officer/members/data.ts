import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MemberRow } from "@/lib/types";

export async function getMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_attendance")
    .select("id, uniqname, full_name, nickname, roblox_username, roblox_user_id, is_officer, is_owner, created_at, total_attendance, last_checked_in_at")
    .order("total_attendance", { ascending: false })
    .order("full_name", { ascending: true })
    .returns<MemberRow[]>();
  if (error) console.error("Failed to load members", error.message);
  return data ?? [];
}
