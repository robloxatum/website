// Push notifications: which subscriptions we accept, the texts, and which events get reminders. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dueForReminder, gameLinkMessage, isPushEndpoint, parseSubscription, reminderMessage } from "../src/lib/push/subscription.ts";

const P256DH = "B" + "A".repeat(86); // 87 chars: 65 bytes, base64url
const AUTH = "C".repeat(22); // 16 bytes
const sub = (endpoint, keys = { p256dh: P256DH, auth: AUTH }) => ({ endpoint, keys });

describe("isPushEndpoint: the browsers' push services only", () => {
  it("accepts Chrome/Android, Firefox, Apple and Windows push URLs", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc:APA91b",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://web.push.apple.com/QGx3Y",
      "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
    ]) assert.equal(isPushEndpoint(url), true, url);
  });

  it("refuses anything else: other hosts, http, look-alikes, ports, credentials, internal addresses", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evilfcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://169.254.169.254/latest/meta-data",
      "http://127.0.0.1:3298/push/1",
      "https://example.com/push",
      "javascript:alert(1)",
      "",
      `https://fcm.googleapis.com/${"a".repeat(1000)}`,
      42,
      null,
    ]) assert.equal(isPushEndpoint(url), false, String(url));
  });

  it("regression: never a local address, not even in test builds", () => {
    // No local exception, even when asked (the old test-only allowLocal flag is gone).
    for (const url of ["http://127.0.0.1:3298/push/1", "http://localhost:3298/push/1", "https://localhost/push/1", "https://127.0.0.1/x"]) {
      assert.equal(isPushEndpoint(url, true), false, url);
      assert.equal(parseSubscription({ endpoint: url, keys: { p256dh: P256DH, auth: AUTH } }, true), null, url);
    }
  });
});

describe("parseSubscription", () => {
  it("keeps the endpoint and keys (padding trimmed)", () => {
    assert.deepEqual(parseSubscription(sub("https://web.push.apple.com/x", { p256dh: `${P256DH}=`, auth: `${AUTH}==` })), {
      endpoint: "https://web.push.apple.com/x",
      p256dh: P256DH,
      auth: AUTH,
    });
  });

  it("refuses bad keys or shapes", () => {
    const ok = "https://fcm.googleapis.com/fcm/send/x";
    assert.equal(parseSubscription(sub(ok, { p256dh: "short", auth: AUTH })), null);
    assert.equal(parseSubscription(sub(ok, { p256dh: P256DH, auth: "has spaces in it......" })), null);
    assert.equal(parseSubscription(sub(ok, {})), null);
    assert.equal(parseSubscription({ endpoint: ok }), null);
    assert.equal(parseSubscription("nope"), null);
    assert.equal(parseSubscription(null), null);
  });
});

describe("notification texts", () => {
  it("reminder: day, title, time and place, opening the event", () => {
    assert.deepEqual(reminderMessage({ id: "e1", title: "Game Night", location: "BBB 1670" }, "Today", "7:00 PM"), {
      title: "Today: Game Night",
      body: "7:00 PM · BBB 1670. Tap for details.",
      url: "/events/e1",
      tag: "reminder-e1",
    });
    assert.equal(reminderMessage({ id: "e1", title: "Game Night", location: "  " }, "Tomorrow", "7:00 PM").body, "7:00 PM. Tap for details.");
  });

  it("game link: opens /play and never carries the link", () => {
    const m = gameLinkMessage({ id: "e1", title: "Game Night" }, "Server 1", false);
    assert.equal(m.title, "The game link is live");
    assert.equal(m.body, "“Server 1” for Game Night is up. Tap to join.");
    assert.equal(m.url, "/play");
    assert.equal(m.tag, "game-e1");
    assert.equal(gameLinkMessage({ id: "e1", title: "Game Night" }, null, true).title, "New game link");
    assert.doesNotMatch(JSON.stringify(m), /roblox\.com/);
  });
});

describe("dueForReminder", () => {
  const now = new Date("2026-11-25T14:00:00Z");
  const at = (h) => new Date(now.getTime() + h * 3600_000).toISOString();
  const events = [
    { id: "started", starts_at: at(-1) },
    { id: "tonight", starts_at: at(9) },
    { id: "tomorrow-morning", starts_at: at(23.5) },
    { id: "too-far", starts_at: at(25) },
    { id: "already", starts_at: at(5) },
  ];

  it("events starting within 24 hours, not yet started or reminded", () => {
    assert.deepEqual(dueForReminder(events, now, new Set(["already"])).map((e) => e.id), ["tonight", "tomorrow-morning"]);
  });
});
