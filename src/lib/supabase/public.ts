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
    // Never let Next's fetch cache keep these responses: it has no tags (so an
    // officer's edit can't clear it), lasts 15 minutes and survives into the
    // next build. "use cache" + cacheTag("events") is the only cache we want.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
