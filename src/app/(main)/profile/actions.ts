"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile, getUser } from "@/lib/auth";
import { headshotFor, lookupRobloxUser } from "@/lib/roblox";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = { error?: string; saved?: boolean; notice?: string };

const ROBLOX_USERNAME = /^[A-Za-z0-9_]{3,20}$/;
const USERNAME_RULES = "Roblox usernames are 3–20 characters: letters, numbers and underscores.";

function cleanUsername(raw: unknown) {
  return String(raw ?? "").trim().replace(/^@/, "");
}

export type RobloxPreview =
  | { status: "found"; name: string; displayName: string; headshot: string | null }
  | { status: "not_found" | "unavailable" | "invalid"; message: string };

/**
 * "Is this you?" check before saving: the Roblox account a username belongs
 * to, with its current headshot. Only catches typos; it proves nothing.
 * Signed-in members only, so this isn't an open proxy to Roblox.
 */
export async function previewRobloxUser(rawUsername: string): Promise<RobloxPreview> {
  if (!(await getUser())) return { status: "unavailable", message: "Please sign in again." };
  const username = cleanUsername(rawUsername);
  if (!ROBLOX_USERNAME.test(username)) return { status: "invalid", message: USERNAME_RULES };

  const result = await lookupRobloxUser(username);
  if (result.status === "not_found") {
    return { status: "not_found", message: `We couldn't find a Roblox user called “${username}”. Check the spelling.` };
  }
  if (result.status === "unavailable") {
    return { status: "unavailable", message: "We couldn't reach Roblox to check that username. You can still save it." };
  }
  const { user } = result;
  return {
    status: "found",
    name: user.name,
    displayName: user.displayName,
    headshot: await headshotFor({ roblox_user_id: user.id }),
  };
}

export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  let roblox = cleanUsername(formData.get("roblox_username"));
  const onboarding = formData.get("mode") === "welcome";

  if (!fullName) return { error: "Please enter your name." };
  if (fullName.length > 100) return { error: "That name is too long (100 characters max)." };
  if (roblox && !ROBLOX_USERNAME.test(roblox)) return { error: USERNAME_RULES };

  // Resolve the Roblox user ID server-side (never trusted from the browser).
  // Unchanged username: keep the ID we have. Roblox unreachable: save the
  // username anyway; the avatar is looked up from it later.
  let robloxUserId: number | null = null;
  let notice: string | undefined;
  if (roblox) {
    const current = await getProfile();
    if (current?.roblox_user_id && current.roblox_username?.toLowerCase() === roblox.toLowerCase()) {
      robloxUserId = current.roblox_user_id;
    } else {
      const result = await lookupRobloxUser(roblox);
      if (result.status === "not_found") {
        return { error: `We couldn't find a Roblox user called “${roblox}”. Check the spelling.` };
      }
      if (result.status === "found") {
        robloxUserId = result.user.id;
        roblox = result.user.name || roblox; // Roblox's own capitalization
      } else {
        notice = "We couldn't reach Roblox just now, so your avatar may take a little while to appear.";
      }
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      roblox_username: roblox || null,
      roblox_user_id: robloxUserId,
      ...(onboarding ? { onboarded_at: new Date().toISOString() } : {}),
    })
    .eq("id", user.id);

  if (error) return { error: "Couldn't save your profile. Please try again." };

  if (onboarding) redirect(safeNext(String(formData.get("next") ?? "/")));
  refresh(); // the header icon shows the new avatar
  return { saved: true, notice };
}
