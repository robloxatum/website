import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export function isUmichEmail(email: string | null | undefined) {
  return !!email && email.toLowerCase().endsWith("@umich.edu");
}

/** The signed-in user from the verified JWT, or null. Deduplicated per request. */
export const getUser = cache(async () => {
  // Session reads happen at request time only. Without this, Partial
  // Prefetching renders a per-session shell ahead of time, which (a) trips
  // Next's "Date.now() while prerendering" check (Supabase compares the JWT
  // expiry with the clock) and (b) is cached in the browser, so pages like the
  // officer dashboard could show stale counts after a change.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
});

/** The signed-in user's profile, or null if signed out (or no profile yet). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, uniqname, full_name, nickname, roblox_username, roblox_user_id, is_officer, onboarded_at, created_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  return data ?? null;
});

/**
 * Require a signed-in, onboarded member. Redirects to /login or /welcome and
 * comes back to `returnTo` afterwards.
 */
export async function requireMember(returnTo: string): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!profile.onboarded_at) redirect(`/welcome?next=${encodeURIComponent(returnTo)}`);
  return profile;
}

/**
 * For officer pages: redirects signed-out visitors to /login and returns null
 * for members who aren't officers (the page then shows "officers only").
 * This is for UX only; RLS is what actually protects the data.
 */
export async function getOfficer(returnTo: string): Promise<Profile | null> {
  const profile = await requireMember(returnTo);
  return profile.is_officer ? profile : null;
}
