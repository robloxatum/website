import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The browser Supabase client, loaded on first use. Public pages (the header's
 * Play button, RSVP, sign-in) only need it after the page is up, so the library
 * (~70 KB gzipped) stays out of the first download. Same shared instance as
 * createClient().
 */
export function loadClient(): Promise<SupabaseClient> {
  return import("./client").then((m) => m.createClient());
}
