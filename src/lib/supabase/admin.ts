import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Supabase with the SECRET key: bypasses RLS. Push notifications only
 * (lib/push/send.ts): reading other members' devices to notify them, and the
 * reminder log. Nothing else may import this (eslint enforces it).
 * Null when SUPABASE_SECRET_KEY isn't set (push is then off).
 */
export function createAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
