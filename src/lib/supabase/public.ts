import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "./env";

/**
 * Cookie-free client for public data (events) inside "use cache" functions.
 * It runs as the anon role, so it can only read what RLS allows anonymous visitors.
 */
export function createPublicClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
