"use server";

import { getUser } from "@/lib/auth";
import { normalizeCode } from "@/lib/checkin-state";
import { createClient } from "@/lib/supabase/server";
import type { CheckinResult } from "@/lib/types";

/** Check-in is validated and recorded entirely by public.check_in() in Postgres. */
export async function checkIn(rawCode: string): Promise<CheckinResult> {
  const user = await getUser();
  if (!user) return { status: "not_signed_in", event_title: null };

  const code = normalizeCode(String(rawCode ?? "")).slice(0, 10);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in", { p_code: code });

  if (error || !data) {
    console.error("check_in failed", error?.message);
    return { status: "error", event_title: null };
  }
  return data as CheckinResult;
}
