"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = { error?: string; saved?: boolean };

const ROBLOX_USERNAME = /^[A-Za-z0-9_]{3,20}$/;

export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const roblox = String(formData.get("roblox_username") ?? "").trim().replace(/^@/, "");
  const onboarding = formData.get("mode") === "welcome";

  if (!fullName) return { error: "Please enter your name." };
  if (fullName.length > 100) return { error: "That name is too long (100 characters max)." };
  if (roblox && !ROBLOX_USERNAME.test(roblox)) {
    return {
      error: "Roblox usernames are 3–20 characters: letters, numbers and underscores.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      roblox_username: roblox || null,
      ...(onboarding ? { onboarded_at: new Date().toISOString() } : {}),
    })
    .eq("id", user.id);

  if (error) return { error: "Couldn't save your profile. Please try again." };

  if (onboarding) redirect(safeNext(String(formData.get("next") ?? "/")));
  return { saved: true };
}
