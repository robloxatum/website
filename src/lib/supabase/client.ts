import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authCookieOptions } from "./cookie-options";
import { supabaseKey, supabaseUrl } from "./env";

let client: SupabaseClient | undefined;

/** Supabase client for Client Components (one shared instance per tab). */
export function createClient(): SupabaseClient {
  client ??= createBrowserClient(supabaseUrl, supabaseKey, { cookieOptions: authCookieOptions() });
  return client;
}
