import "server-only";
import { e2eEnabled } from "@/lib/e2e";
import { createClient } from "@/lib/supabase/server";
import { parseSubscription } from "./subscription";

// This member's own devices, as the signed-in member (RLS). Used by the
// notification settings (profile) and the service worker's re-subscribe.

export type DeviceSettings = { eventReminders: boolean; gameLinks: boolean };

/** Save (or move to this member) a device's push subscription. */
export async function saveDevice(
  subscription: unknown,
  settings: Partial<DeviceSettings>,
  replaces: string | null = null,
): Promise<{ error?: string }> {
  const sub = parseSubscription(subscription, e2eEnabled());
  if (!sub) return { error: "This browser's notification details didn't look right." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
    p_event_reminders: settings.eventReminders ?? null,
    p_game_links: settings.gameLinks ?? null,
    p_replaces: typeof replaces === "string" && replaces.length <= 1000 ? replaces : null,
  });
  if (error) {
    console.error("Couldn't save push device", error.message);
    return { error: "Couldn't turn on notifications. Please try again." };
  }
  return {};
}

export async function getDeviceSettings(endpoint: string): Promise<DeviceSettings | null> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("event_reminders, game_links")
    .eq("endpoint", endpoint)
    .maybeSingle();
  return data ? { eventReminders: data.event_reminders, gameLinks: data.game_links } : null;
}

export async function updateDeviceSettings(endpoint: string, settings: DeviceSettings): Promise<{ error?: string }> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { error: "Couldn't save that." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .update({ event_reminders: !!settings.eventReminders, game_links: !!settings.gameLinks, updated_at: new Date().toISOString() })
    .eq("endpoint", endpoint)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't save that. Please try again." };
  return {};
}

export async function removeDevice(endpoint: string): Promise<void> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return;
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
