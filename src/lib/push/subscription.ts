// Push notification pieces with no server dependencies: checking a browser's
// push subscription, and the notification texts. No runtime imports: the unit
// tests run this file directly with Node.

export type SavedSubscription = { endpoint: string; p256dh: string; auth: string };

export type PushMessage = {
  title: string;
  body: string;
  /** Our own page to open when tapped. */
  url: string;
  /** A newer notification with the same tag replaces the older one on the device. */
  tag: string;
};

// The browsers' push services. Anything else is refused, so the server never
// sends requests to an address someone made up.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge, Android
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari, iPhone home-screen apps
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge (Windows)
];

/**
 * A push-service URL (the database's push_subscriptions_endpoint_check is the
 * same rule). No exception for local addresses, not even in tests: E2E builds
 * deliver to a local mock by path instead (lib/push/send.ts).
 */
export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  return u.protocol === "https:" && !u.username && !u.password && !u.port && PUSH_HOSTS.some((h) => h.test(u.hostname));
}

const P256DH = /^[A-Za-z0-9_-]{86,88}$/;
const AUTH = /^[A-Za-z0-9_-]{22,24}$/;

/** A browser's PushSubscription.toJSON(), checked; null if anything's off. */
export function parseSubscription(input: unknown): SavedSubscription | null {
  if (!input || typeof input !== "object") return null;
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (!isPushEndpoint(endpoint)) return null;
  const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh.replace(/=+$/, "") : "";
  const auth = typeof keys?.auth === "string" ? keys.auth.replace(/=+$/, "") : "";
  if (!P256DH.test(p256dh) || !AUTH.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

/** "Today: Game Night" / "7:00 PM · BBB 1670". `day` is "Today" or "Tomorrow". */
export function reminderMessage(event: { id: string; title: string; location: string }, day: string, time: string): PushMessage {
  return {
    title: `${day}: ${event.title}`,
    body: [time, event.location.trim()].filter(Boolean).join(" · ") + ". Tap for details.",
    url: `/events/${event.id}`,
    tag: `reminder-${event.id}`,
  };
}

/**
 * "The game link is live". Never contains the link itself: tapping opens
 * /play, which shows it only to members checked in while the event is live.
 */
export function gameLinkMessage(event: { id: string; title: string }, label: string | null, replaced: boolean): PushMessage {
  const what = label ? `“${label}”` : "The game link";
  return {
    title: replaced ? "New game link" : "The game link is live",
    body: `${what} for ${event.title} is up. Tap to join.`,
    url: "/play",
    tag: `game-${event.id}`,
  };
}

/**
 * Events that get a reminder now: starting within the next 24 hours (the cron
 * runs daily), not yet started, and not reminded before.
 */
export function dueForReminder<E extends { id: string; starts_at: string }>(events: E[], now: Date, alreadySent: Set<string>): E[] {
  const from = now.getTime();
  const to = from + 24 * 60 * 60 * 1000;
  return events.filter((e) => {
    const t = new Date(e.starts_at).getTime();
    return t > from && t <= to && !alreadySent.has(e.id);
  });
}
