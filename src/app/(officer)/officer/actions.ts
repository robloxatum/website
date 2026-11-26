"use server";

import { refresh, revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { CATEGORY_KEYS } from "@/lib/categories";
import { isUuid } from "@/lib/events";
import { normalizeLink, normalizeMessage } from "@/lib/announcement";
import { GAME_SERVERS_MAX, defaultServerLabel, moveId, normalizeGameLabel, normalizeGameLink, sortServers } from "@/lib/game-links";
import { COVER_MIN_HEIGHT, COVER_MIN_WIDTH, COVER_PATH, FLYER_BUCKET, FLYER_MAX_DIMENSION, FLYER_PATH } from "@/lib/flyers";
import { notifyGameLinkLive } from "@/lib/push/send";
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

async function objectExists(supabase: Supabase, path: string) {
  try {
    const { data } = await supabase.storage.from(FLYER_BUCKET).exists(path); // exact name; officer RLS
    return data === true;
  } catch {
    return false;
  }
}

/** Delete a flyer or cover file from the bucket (best effort). */
async function removeObject(supabase: Supabase, path: string) {
  if (!FLYER_PATH.test(path) && !COVER_PATH.test(path)) return;
  const { error } = await supabase.storage.from(FLYER_BUCKET).remove([path]);
  if (error) console.error("Failed to delete old image", error.message);
}

type ImageKind = "flyer" | "cover";
const IMAGE_RULES: Record<ImageKind, { path: RegExp; minWidth: number; minHeight: number }> = {
  flyer: { path: FLYER_PATH, minWidth: 1, minHeight: 1 },
  cover: { path: COVER_PATH, minWidth: COVER_MIN_WIDTH, minHeight: COVER_MIN_HEIGHT },
};

/**
 * "<kind>_action" is "keep" (default), "remove", or "replace" with an object the
 * browser already uploaded to Storage (officer RLS). Returns the columns to set
 * (undefined = leave as is), or an error.
 */
function readImageField(formData: FormData, kind: ImageKind) {
  const action = String(formData.get(`${kind}_action`) ?? "keep");
  const rules = IMAGE_RULES[kind];
  if (action === "remove") return { values: { [`${kind}_path`]: null, [`${kind}_width`]: null, [`${kind}_height`]: null }, path: null };
  if (action !== "replace") return { values: undefined, path: undefined };
  const path = String(formData.get(`${kind}_path`) ?? "");
  const width = Number(formData.get(`${kind}_width`));
  const height = Number(formData.get(`${kind}_height`));
  const ok = (n: number, min: number) => Number.isInteger(n) && n >= min && n <= FLYER_MAX_DIMENSION;
  if (!rules.path.test(path) || !ok(width, rules.minWidth) || !ok(height, rules.minHeight)) {
    return { error: `That ${kind} upload didn't work. Please try again.` };
  }
  return { values: { [`${kind}_path`]: path, [`${kind}_width`]: width, [`${kind}_height`]: height }, path };
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

  const flyer = readImageField(formData, "flyer");
  if ("error" in flyer) return { error: flyer.error };
  const cover = readImageField(formData, "cover");
  if ("error" in cover) return { error: cover.error };

  const values = { title, location, description, starts_at: startsAt, ends_at: endsAt, category, capacity, ...flyer.values, ...cover.values };
  const supabase = await createClient();

  // Make sure uploaded files really are in the bucket, so the page never shows a broken image.
  for (const [kind, path] of [["flyer", flyer.path], ["cover", cover.path]] as const) {
    if (path && !(await objectExists(supabase, path))) return { error: `The ${kind} upload didn't finish. Please try again.` };
  }

  let eventId = id;
  let old: { flyer_path: string | null; cover_path: string | null } | null = null;
  if (id) {
    if (!isUuid(id)) return { error: "Unknown event." };
    if (flyer.values || cover.values) {
      const { data } = await supabase
        .from("events")
        .select("flyer_path, cover_path")
        .eq("id", id)
        .maybeSingle<{ flyer_path: string | null; cover_path: string | null }>();
      old = data ?? null;
    }
    const { error } = await supabase.from("events").update(values).eq("id", id);
    if (error) return { error: "Couldn't save the event. Please try again." };
  } else {
    const { data, error } = await supabase.from("events").insert(values).select("id").single();
    if (error || !data) return { error: "Couldn't create the event. Please try again." };
    eventId = data.id;
  }

  // The event no longer points at the old files: delete them (best effort).
  if (old?.flyer_path && flyer.values && old.flyer_path !== flyer.path) await removeObject(supabase, old.flyer_path);
  if (old?.cover_path && cover.values && old.cover_path !== cover.path) await removeObject(supabase, old.cover_path);

  updateTag("events");
  // Also the event's own cached page, so its next visitor sees the change.
  revalidatePath(`/events/${eventId}`);
  redirect(`/officer/events/${eventId}?saved=1`);
}

export async function deleteEvent(eventId: string) {
  await requireOfficerAction();
  if (!isUuid(eventId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("flyer_path, cover_path")
    .eq("id", eventId)
    .maybeSingle<{ flyer_path: string | null; cover_path: string | null }>();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (!error && data?.flyer_path) await removeObject(supabase, data.flyer_path);
  if (!error && data?.cover_path) await removeObject(supabase, data.cover_path);
  updateTag("events");
  revalidatePath(`/events/${eventId}`);
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
    if (error.code === "42501") return { error: "Only owners can make or remove officers." };
    if (/owners can't be removed/i.test(error.message)) return { error: "Owners can't be removed as officers." };
    if (/last officer/i.test(error.message)) {
      return { error: "You can't remove the last officer. Make someone else an officer first." };
    }
    return { error: "Couldn't change officer status. Please try again." };
  }
  refresh();
  return {};
}

/** Clear a member's nickname, e.g. an inappropriate one (officers only; enforced by clear_nickname()). */
export async function clearNickname(userId: string): Promise<{ error?: string }> {
  await requireOfficerAction();
  if (!isUuid(userId)) return { error: "Unknown member." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_nickname", { p_user_id: userId });
  if (error) return { error: "Couldn't clear the nickname. Please try again." };
  refresh();
  return {};
}

/** Checks an officer's link + label; a blank label becomes the next "Server N". */
function parseServer(rawUrl: string, rawLabel: string, fallbackLabel: string): { url: string; label: string } | { error: string } {
  const link = normalizeGameLink(rawUrl);
  if ("error" in link) return { error: link.error };
  const label = normalizeGameLabel(rawLabel);
  if ("error" in label) return { error: label.error };
  return { url: link.url, label: label.label ?? fallbackLabel };
}

/** Add a live game server to the event (officers only; RLS and a 10-server cap enforce it too). */
export async function addGameServer(eventId: string, rawUrl: string, rawLabel: string): Promise<{ error?: string }> {
  const officer = await requireOfficerAction();
  if (!isUuid(eventId)) return { error: "Unknown event." };
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase.from("event_game_servers").select("label, position").eq("event_id", eventId);
  if (readError) return { error: "Couldn't add the server. Please try again." };
  if (existing.length >= GAME_SERVERS_MAX) return { error: `An event can have up to ${GAME_SERVERS_MAX} servers. Remove one first.` };
  const parsed = parseServer(rawUrl, rawLabel, defaultServerLabel(existing));
  if ("error" in parsed) return { error: parsed.error };

  const position = existing.reduce((max, s) => Math.max(max, s.position + 1), 0);
  const { error } = await supabase
    .from("event_game_servers")
    .insert({ event_id: eventId, url: parsed.url, label: parsed.label, position, updated_by: officer.id });
  if (error) {
    if (/at most 10/i.test(error.message)) return { error: `An event can have up to ${GAME_SERVERS_MAX} servers. Remove one first.` };
    return { error: "Couldn't add the server. Please try again." };
  }
  // The first server going up: push "the game link is live" to checked-in
  // members who want it, after the officer's response is sent.
  if (existing.length === 0) {
    after(() => notifyGameLinkLive(eventId, parsed.label, false, officer.id).catch((e) => console.error("Game link push failed", e)));
  }
  refresh();
  return {};
}

/** Replace a server's link and/or label. */
export async function updateGameServer(serverId: string, rawUrl: string, rawLabel: string): Promise<{ error?: string }> {
  const officer = await requireOfficerAction();
  if (!isUuid(serverId)) return { error: "Unknown server." };
  const supabase = await createClient();
  const { data: current } = await supabase.from("event_game_servers").select("label").eq("id", serverId).maybeSingle();
  if (!current) return { error: "That server was removed. Refresh the page." };
  const parsed = parseServer(rawUrl, rawLabel, current.label);
  if ("error" in parsed) return { error: parsed.error };
  const { error } = await supabase
    .from("event_game_servers")
    .update({ url: parsed.url, label: parsed.label, updated_at: new Date().toISOString(), updated_by: officer.id })
    .eq("id", serverId);
  if (error) return { error: "Couldn't save the server. Please try again." };
  refresh();
  return {};
}

/** Mark a server full (members see it greyed out) or open again. */
export async function setGameServerFull(serverId: string, full: boolean): Promise<{ error?: string }> {
  const officer = await requireOfficerAction();
  if (!isUuid(serverId)) return { error: "Unknown server." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_game_servers")
    .update({ is_full: full, updated_at: new Date().toISOString(), updated_by: officer.id })
    .eq("id", serverId)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't update the server. Please try again." };
  refresh();
  return {};
}

/** Move a server one place up or down in the list members see. */
export async function moveGameServer(eventId: string, serverId: string, direction: -1 | 1): Promise<{ error?: string }> {
  await requireOfficerAction();
  if (!isUuid(eventId) || !isUuid(serverId) || (direction !== -1 && direction !== 1)) return { error: "Unknown server." };
  const supabase = await createClient();
  const { data, error: readError } = await supabase.from("event_game_servers").select("id, position, created_at").eq("event_id", eventId);
  if (readError) return { error: "Couldn't reorder the servers. Please try again." };
  const ids = moveId(sortServers(data).map((s) => s.id), serverId, direction);
  const { error } = await supabase.rpc("reorder_game_servers", { p_event_id: eventId, p_ids: ids });
  if (error) return { error: "Couldn't reorder the servers. Please try again." };
  refresh();
  return {};
}

/** Take a server down. */
export async function removeGameServer(serverId: string): Promise<{ error?: string }> {
  await requireOfficerAction();
  if (!isUuid(serverId)) return { error: "Unknown server." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_game_servers").delete().eq("id", serverId);
  if (error) return { error: "Couldn't remove the server. Please try again." };
  refresh();
  return {};
}

export type AnnouncementFormState = { error?: string; published?: boolean; cleared?: boolean };

/** Our own hosts, so a full link to this site is stored as a path. */
async function siteHosts() {
  const hosts = new Set<string>();
  const host = (await headers()).get("host")?.split(":")[0];
  if (host) hosts.add(host);
  try {
    if (process.env.NEXT_PUBLIC_SITE_URL) hosts.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname);
  } catch {}
  return [...hosts];
}

/** Publish (replacing any current announcement) or clear the site banner. */
export async function saveAnnouncement(_prev: AnnouncementFormState, formData: FormData): Promise<AnnouncementFormState> {
  await requireOfficerAction();
  const supabase = await createClient();

  if (formData.get("intent") === "clear") {
    const { error } = await supabase.from("announcements").delete().not("id", "is", null);
    if (error) return { error: "Couldn't clear the announcement. Please try again." };
    updateTag("announcement");
    return { cleared: true };
  }

  const message = normalizeMessage(String(formData.get("message") ?? ""));
  if ("error" in message) return { error: message.error };
  const link = normalizeLink(String(formData.get("link") ?? ""), await siteHosts());
  if ("error" in link) return { error: link.error };
  const style = formData.get("style") === "urgent" ? "urgent" : "info";
  const hideRaw = String(formData.get("hide_after") ?? "").trim();
  let hideAfter: string | null = null;
  if (hideRaw) {
    hideAfter = fromClubInputValue(hideRaw);
    if (!hideAfter) return { error: "Pick a valid date and time for “Hide after”." };
    if (new Date(hideAfter).getTime() <= Date.now()) return { error: "“Hide after” must be in the future." };
  }

  // One announcement at a time: replace it. A new row (new id) means visitors
  // who dismissed the old one see this one.
  const { error: delError } = await supabase.from("announcements").delete().not("id", "is", null);
  if (delError) return { error: "Couldn't publish the announcement. Please try again." };
  const { error } = await supabase
    .from("announcements")
    .insert({ message: message.message, link: link.link, style, hide_after: hideAfter });
  if (error) return { error: "Couldn't publish the announcement. Please try again." };
  updateTag("announcement");
  return { published: true };
}
