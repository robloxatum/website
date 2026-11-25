import "server-only";
import { generateRequestDetails } from "web-push";
import { e2eEnabled } from "@/lib/e2e";
import { siteUrl } from "@/lib/metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_TIME_ZONE, formatTime } from "@/lib/time";
import { dueForReminder, gameLinkMessage, isPushEndpoint, reminderMessage, type PushMessage } from "./subscription";

// Sending push notifications (Web Push with VAPID). Needs, on the server:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   (npx web-push generate-vapid-keys)
//   SUPABASE_SECRET_KEY                               (to read other members' devices)
//   VAPID_SUBJECT (optional)                          mailto: or https: contact; defaults to the site URL
// Without them, nothing is sent and the settings card stays hidden.

type Row = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
const COLUMNS = "id, user_id, endpoint, p256dh, auth";

function vapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  const subject = process.env.VAPID_SUBJECT || siteUrl();
  return { publicKey, privateKey, subject };
}

export function pushConfigured(): boolean {
  return Boolean(vapid() && process.env.SUPABASE_SECRET_KEY);
}

export type SendResult = { sent: number; removed: number; failed: number };

/**
 * Sends one message to each device. Devices the push service says are gone
 * (404/410: notifications turned off, app removed) are deleted.
 */
async function sendToDevices(rows: Row[], message: PushMessage, opts: { ttl: number; urgency: "normal" | "high" }): Promise<SendResult> {
  const vapidDetails = vapid();
  const db = createAdminClient();
  const result: SendResult = { sent: 0, removed: 0, failed: 0 };
  if (!vapidDetails || !db || rows.length === 0) return result;
  const payload = JSON.stringify(message);
  const allowLocal = e2eEnabled();
  const gone: string[] = [];

  const one = async (row: Row) => {
    if (!isPushEndpoint(row.endpoint, allowLocal)) {
      gone.push(row.id);
      return;
    }
    try {
      const req = generateRequestDetails({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, {
        vapidDetails,
        TTL: opts.ttl,
        urgency: opts.urgency,
        topic: message.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32),
      });
      const res = await fetch(req.endpoint, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.body ? new Uint8Array(req.body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 404 || res.status === 410) gone.push(row.id);
      else if (res.ok) result.sent++;
      else {
        result.failed++;
        console.error("Push refused", res.status, new URL(row.endpoint).host);
      }
    } catch (e) {
      result.failed++;
      console.error("Push failed", e instanceof Error ? e.message : e);
    }
  };

  // A few at a time.
  const queue = [...rows];
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
    for (let row = queue.shift(); row; row = queue.shift()) await one(row);
  }));

  if (gone.length) {
    const { error } = await db.from("push_subscriptions").delete().in("id", gone);
    if (error) console.error("Couldn't remove expired push devices", error.message);
    else result.removed = gone.length;
  }
  return result;
}

/**
 * "The game link is live": to members checked in to the event who turned that
 * on, except the officer who posted it. Only while the event is live (members
 * can't open the link otherwise).
 */
export async function notifyGameLinkLive(eventId: string, label: string | null, replaced: boolean, postedBy: string): Promise<SendResult> {
  const db = createAdminClient();
  if (!db || !vapid()) return { sent: 0, removed: 0, failed: 0 };
  const { data: event } = await db.from("events").select("id, title, starts_at, ends_at").eq("id", eventId).maybeSingle();
  const now = Date.now();
  if (!event || new Date(event.starts_at).getTime() > now || new Date(event.ends_at).getTime() <= now) {
    return { sent: 0, removed: 0, failed: 0 };
  }
  const { data: attendees } = await db.from("attendance").select("user_id").eq("event_id", eventId);
  const ids = (attendees ?? []).map((a) => a.user_id as string).filter((id) => id !== postedBy);
  if (!ids.length) return { sent: 0, removed: 0, failed: 0 };
  const { data: rows, error } = await db.from("push_subscriptions").select(COLUMNS).eq("game_links", true).in("user_id", ids);
  if (error) {
    console.error("Couldn't read push devices", error.message);
    return { sent: 0, removed: 0, failed: 0 };
  }
  return sendToDevices((rows ?? []) as Row[], gameLinkMessage(event, label, replaced), { ttl: 60 * 60, urgency: "high" });
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: CLUB_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Daily (cron): a reminder for each event starting in the next 24 hours, to
 * everyone who turned reminders on. Each event is reminded once, ever.
 */
export async function sendDueReminders(now = new Date()): Promise<{ events: number } & SendResult> {
  const total = { events: 0, sent: 0, removed: 0, failed: 0 };
  const db = createAdminClient();
  if (!db || !vapid()) return total;
  const until = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error } = await db
    .from("events")
    .select("id, title, location, starts_at")
    .gt("starts_at", now.toISOString())
    .lte("starts_at", until)
    .order("starts_at");
  if (error) throw new Error(`Couldn't read events: ${error.message}`);
  if (!events?.length) return total;
  const { data: sent } = await db.from("event_reminders_sent").select("event_id").in("event_id", events.map((e) => e.id));
  const due = dueForReminder(events, now, new Set((sent ?? []).map((s) => s.event_id as string)));
  if (!due.length) return total;

  const { data: rows, error: devicesError } = await db.from("push_subscriptions").select(COLUMNS).eq("event_reminders", true);
  if (devicesError) throw new Error(`Couldn't read push devices: ${devicesError.message}`);

  for (const event of due) {
    // Claim it first: if two runs overlap, only one sends.
    const { error: claimError } = await db.from("event_reminders_sent").insert({ event_id: event.id });
    if (claimError) continue;
    const today = dayFmt.format(now) === dayFmt.format(new Date(event.starts_at));
    const r = await sendToDevices((rows ?? []) as Row[], reminderMessage(event, today ? "Today" : "Tomorrow", formatTime(event.starts_at)), {
      ttl: 6 * 60 * 60,
      urgency: "normal",
    });
    total.events++;
    total.sent += r.sent;
    total.removed += r.removed;
    total.failed += r.failed;
  }
  return total;
}
