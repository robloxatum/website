"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { CATEGORY_KEYS } from "@/lib/categories";
import { isUuid } from "@/lib/events";
import { FLYER_BUCKET, FLYER_MAX_DIMENSION, FLYER_PATH } from "@/lib/flyers";
import { createClient } from "@/lib/supabase/server";
import { fromClubInputValue } from "@/lib/time";

// These checks give friendly errors. RLS and the SQL functions are the real gate.
async function requireOfficerAction() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/officer");
  if (!profile.is_officer) throw new Error("Officers only");
  return profile;
}

export type EventFormState = { error?: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function flyerExists(supabase: Supabase, path: string) {
  try {
    const { data } = await supabase.storage.from(FLYER_BUCKET).exists(path); // exact name; officer RLS
    return data === true;
  } catch {
    return false;
  }
}

async function removeFlyer(supabase: Supabase, path: string) {
  if (!FLYER_PATH.test(path)) return;
  const { error } = await supabase.storage.from(FLYER_BUCKET).remove([path]);
  if (error) console.error("Failed to delete old flyer", error.message);
}

export async function saveEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  await requireOfficerAction();

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startsAt = fromClubInputValue(String(formData.get("starts_at") ?? ""));
  const endsAt = fromClubInputValue(String(formData.get("ends_at") ?? ""));
  const category = String(formData.get("category") ?? "meeting");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;

  if (!title) return { error: "Give the event a title." };
  if (title.length > 120) return { error: "Title is too long (120 characters max)." };
  if (location.length > 200) return { error: "Location is too long (200 characters max)." };
  if (description.length > 5000) return { error: "Description is too long (5000 characters max)." };
  if (!startsAt || !endsAt) return { error: "Pick a start and end time." };
  if (new Date(endsAt) <= new Date(startsAt)) return { error: "The end time must be after the start time." };
  if (!(CATEGORY_KEYS as string[]).includes(category)) return { error: "Pick a category." };
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000)) {
    return { error: "Capacity must be a whole number from 1 to 100,000, or left empty." };
  }

  // Flyer: "keep" (default), "remove", or "replace" with an object the browser
  // already uploaded to Storage (officer RLS) as <uuid>.png|jpg.
  const flyerAction = String(formData.get("flyer_action") ?? "keep");
  let flyer: { flyer_path: string | null; flyer_width: number | null; flyer_height: number | null } | null = null;
  if (flyerAction === "remove") {
    flyer = { flyer_path: null, flyer_width: null, flyer_height: null };
  } else if (flyerAction === "replace") {
    const path = String(formData.get("flyer_path") ?? "");
    const width = Number(formData.get("flyer_width"));
    const height = Number(formData.get("flyer_height"));
    const okSize = (n: number) => Number.isInteger(n) && n >= 1 && n <= FLYER_MAX_DIMENSION;
    if (!FLYER_PATH.test(path) || !okSize(width) || !okSize(height)) return { error: "That flyer upload didn't work. Please try again." };
    flyer = { flyer_path: path, flyer_width: width, flyer_height: height };
  }

  const values = { title, location, description, starts_at: startsAt, ends_at: endsAt, category, capacity, ...flyer };
  const supabase = await createClient();

  // Make sure an uploaded flyer really is in the bucket, so the page never shows a broken image.
  if (flyer?.flyer_path && !(await flyerExists(supabase, flyer.flyer_path))) {
    return { error: "The flyer upload didn't finish. Please try again." };
  }

  let eventId = id;
  let oldFlyer: string | null = null;
  if (id) {
    if (!isUuid(id)) return { error: "Unknown event." };
    if (flyer) {
      const { data } = await supabase.from("events").select("flyer_path").eq("id", id).maybeSingle<{ flyer_path: string | null }>();
      oldFlyer = data?.flyer_path ?? null;
    }
    const { error } = await supabase.from("events").update(values).eq("id", id);
    if (error) return { error: "Couldn't save the event. Please try again." };
  } else {
    const { data, error } = await supabase.from("events").insert(values).select("id").single();
    if (error || !data) return { error: "Couldn't create the event. Please try again." };
    eventId = data.id;
  }

  // The event no longer points at the old flyer: delete the file (best effort).
  if (oldFlyer && oldFlyer !== flyer?.flyer_path) await removeFlyer(supabase, oldFlyer);

  updateTag("events");
  redirect(`/officer/events/${eventId}?saved=1`);
}

export async function deleteEvent(eventId: string) {
  await requireOfficerAction();
  if (!isUuid(eventId)) return;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("flyer_path").eq("id", eventId).maybeSingle<{ flyer_path: string | null }>();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (!error && data?.flyer_path) await removeFlyer(supabase, data.flyer_path);
  updateTag("events");
  redirect("/officer");
}

export type CheckinFlags = { checkin_open: boolean; checkin_reopened: boolean; ends_at: string };

export async function setCheckinOpen(
  eventId: string,
  open: boolean,
): Promise<{ flags?: CheckinFlags; error?: string }> {
  await requireOfficerAction();
  if (!isUuid(eventId)) return { error: "Unknown event." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_checkin_open", { p_event_id: eventId, p_open: open });
  if (error) return { error: "Couldn't change check-in. Please try again." };
  const { data } = await supabase
    .from("events")
    .select("checkin_open, checkin_reopened, ends_at")
    .eq("id", eventId)
    .single<CheckinFlags>();
  refresh();
  return { flags: data ?? undefined };
}

export async function regenerateCode(eventId: string): Promise<{ error?: string }> {
  await requireOfficerAction();
  if (!isUuid(eventId)) return { error: "Unknown event." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_event_code", { p_event_id: eventId });
  if (error) return { error: "Couldn't make a new code. Please try again." };
  refresh();
  return {};
}

export async function removeAttendance(eventId: string, userId: string): Promise<{ error?: string }> {
  await requireOfficerAction();
  if (!isUuid(eventId) || !isUuid(userId)) return { error: "Unknown record." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) return { error: "Couldn't remove that check-in." };
  refresh();
  return {};
}

export async function setOfficer(userId: string, makeOfficer: boolean): Promise<{ error?: string }> {
  await requireOfficerAction();
  if (!isUuid(userId)) return { error: "Unknown member." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_officer", {
    p_user_id: userId,
    p_is_officer: makeOfficer,
  });
  if (error) {
    if (/last officer/i.test(error.message)) {
      return { error: "You can't remove the last officer. Make someone else an officer first." };
    }
    return { error: "Couldn't change officer status. Please try again." };
  }
  refresh();
  return {};
}
