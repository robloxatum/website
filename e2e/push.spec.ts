// 13. Push notifications (opt-in): the profile settings for this device, "game
//     link is live" to checked-in members who want it (never the link itself),
//     the daily event reminders (once per event), expired devices cleaned up,
//     and who may save a device. A local mock push service stands in for
//     Apple/Google/Mozilla: the test decrypts what it receives like a phone would.
import type { Page } from "@playwright/test";
import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { decrypt } from "http_ece";
import { admin, checkInAs, clientAs, createEvent, createUser, SEEDED, userByUniqname, type TestUser } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

type Received = { path: string; headers: IncomingMessage["headers"]; body: Buffer };
let server: Server;
let base = "";
const received: Received[] = [];

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({ path: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) });
      // A device that's gone (notifications turned off, app deleted).
      res.writeHead(req.url?.includes("/gone/") ? 410 : 201).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

test.afterAll(async () => {
  // This mock goes away: so do the devices on it (later reminder runs would try them).
  await admin.from("push_subscriptions").delete().like("endpoint", `${base}/%`);
  await new Promise((r) => server.close(r));
});

/** A phone's push keys, so the test can decrypt what it's sent. */
function device(kind: "ok" | "gone" = "ok") {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16).toString("base64url");
  const endpoint = `${base}/${kind === "gone" ? "gone" : "push"}/${randomUUID()}`;
  return { endpoint, p256dh: ecdh.getPublicKey().toString("base64url"), auth, ecdh };
}
type Device = ReturnType<typeof device>;

async function register(user: TestUser, d: Device, prefs: { event_reminders?: boolean; game_links?: boolean } = {}) {
  const { error } = await admin
    .from("push_subscriptions")
    .insert({ user_id: user.id, endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth, ...prefs });
  expect(error).toBeNull();
}

const pathOf = (d: Device) => new URL(d.endpoint).pathname;
const to = (d: Device) => received.filter((r) => r.path === pathOf(d));

function open(d: Device, r: Received) {
  expect(r.headers["content-encoding"]).toBe("aes128gcm");
  expect(r.headers["authorization"]).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
  return JSON.parse(decrypt(r.body, { version: "aes128gcm", privateKey: d.ecdh, authSecret: d.auth }).toString()) as {
    title: string;
    body: string;
    url: string;
    tag: string;
  };
}

async function postLink(officer: Page, url: string, label?: string) {
  await officer.getByRole("button", { name: /^(Post a link|Add a server)$/ }).click();
  await officer.getByLabel("Roblox private server link").fill(url);
  if (label) await officer.getByLabel(/^Label/).fill(label);
  await officer.getByRole("button", { name: "Add server" }).click();
  await expect(officer.getByText(/Game link is live|servers live/)).toBeVisible();
  await expect(officer.getByRole("button", { name: "Add server" })).toHaveCount(0);
}

const LINK = "https://www.roblox.com/share?code=e2epush111&type=Server";

test("game link is live: a push to checked-in members who want it, without the link; expired devices are removed", async ({ page }) => {
  const event = await createEvent({ open: true, title: "Push Test Night" });
  const [wants, optedOut, notHere, gone] = await Promise.all([createUser(), createUser(), createUser(), createUser()]);
  for (const u of [wants, optedOut, gone]) expect(await checkInAs(u, event.code)).toBe("ok");
  const officer = await userByUniqname(SEEDED.officer);
  expect(await checkInAs(officer, event.code)).toBe("ok");
  const d = { wants: device(), optedOut: device(), notHere: device(), gone: device("gone"), officer: device() };
  await register(wants, d.wants);
  await register(optedOut, d.optedOut, { game_links: false });
  await register(notHere, d.notHere);
  await register(gone, d.gone);
  await register(officer, d.officer); // the one posting it doesn't need telling

  await signIn(page, SEEDED.officer, `/officer/events/${event.id}`);
  await postLink(page, LINK, "Server 1");

  await expect.poll(() => to(d.wants).length).toBe(1);
  const msg = open(d.wants, to(d.wants)[0]);
  expect(msg).toEqual({
    title: "The game link is live",
    body: "“Server 1” for Push Test Night is up. Tap to join.",
    url: "/play",
    tag: `game-${event.id}`,
  });
  expect(to(d.wants)[0].headers["urgency"]).toBe("high");
  expect(to(d.wants)[0].body.includes(Buffer.from("e2epush111"))).toBe(false);

  // The expired device was tried, answered 410, and is gone from the database.
  await expect.poll(() => to(d.gone).length).toBe(1);
  await expect
    .poll(async () => (await admin.from("push_subscriptions").select("id").eq("endpoint", d.gone.endpoint)).data?.length)
    .toBe(0);
  expect(to(d.optedOut)).toEqual([]);
  expect(to(d.notHere)).toEqual([]);
  expect(to(d.officer)).toEqual([]);

  // A second server: no new push (only the first server going live notifies).
  await postLink(page, LINK.replace("111", "222"), "Server 2");
  await expect(page.getByText("2 servers live")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(to(d.wants).length).toBe(1);
});

test("a link posted before the event starts sends nothing (members can't open it yet)", async ({ page }) => {
  const event = await createEvent({ open: true, startMin: 60, endMin: 180 });
  const member = await createUser();
  expect(await checkInAs(member, event.code)).toBe("ok");
  const d = device();
  await register(member, d);
  await signIn(page, SEEDED.officer, `/officer/events/${event.id}`);
  await postLink(page, LINK);
  await page.waitForTimeout(1500);
  expect(to(d)).toEqual([]);
});

test("event reminders: the daily cron reminds those who want it, once per event", async ({ request }) => {
  const soon = await createEvent({ title: "Reminder Soon Night", startMin: 180, endMin: 300, location: "BBB 1670" });
  const later = await createEvent({ title: "Reminder Later Night", startMin: 30 * 60, endMin: 32 * 60 });
  const [wants, optedOut] = await Promise.all([createUser(), createUser()]);
  const d = { wants: device(), optedOut: device() };
  await register(wants, d.wants);
  await register(optedOut, d.optedOut, { event_reminders: false });
  const cron = { Authorization: `Bearer ${process.env.CRON_SECRET}` };

  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
  expect((await request.get("/api/cron/reminders", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);

  const first = await request.get("/api/cron/reminders", { headers: cron });
  expect(first.status()).toBe(200);
  expect(await first.json()).toMatchObject({ ok: true });
  const titles = () => to(d.wants).map((r) => open(d.wants, r).title);
  // "Today" (or "Tomorrow" when the test runs late in the evening, club time).
  await expect.poll(() => titles().some((t) => /^(Today|Tomorrow): Reminder Soon Night$/.test(t))).toBe(true);
  const soonMsg = to(d.wants).map((r) => open(d.wants, r)).find((m) => m.title.endsWith("Reminder Soon Night"))!;
  expect(soonMsg.url).toBe(`/events/${soon.id}`);
  expect(soonMsg.body).toMatch(/^\d{1,2}:\d{2} [AP]M · BBB 1670\. Tap for details\.$/);
  expect(titles().some((t) => t.includes(later.title))).toBe(false); // more than a day away
  expect(to(d.optedOut)).toEqual([]);

  // Again (a retried cron): nothing new.
  const count = to(d.wants).length;
  expect((await request.get("/api/cron/reminders", { headers: cron })).status()).toBe(200);
  await new Promise((r) => setTimeout(r, 500));
  expect(to(d.wants).length).toBe(count);
  expect(titles().filter((t) => t.endsWith("Reminder Soon Night"))).toHaveLength(1);
});

/**
 * Stands in for the browser's push service: subscribe() gives a device on the
 * mock, and notifications are allowed (headless Chromium can't show them).
 */
async function fakePushManager(page: Page, d: Device) {
  await page.addInitScript(
    ({ endpoint, p256dh, auth }) => {
      Object.defineProperty(Notification, "permission", { get: () => "granted", configurable: true });
      Notification.requestPermission = async () => "granted";
      const KEY = "e2e-fake-push";
      const make = (applicationServerKey: ArrayBuffer) => ({
        endpoint,
        options: { applicationServerKey, userVisibleOnly: true },
        toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh, auth } }),
        unsubscribe: async () => {
          localStorage.removeItem(KEY);
          return true;
        },
      });
      const saved = () => {
        const v = localStorage.getItem(KEY);
        return v ? make(new Uint8Array(JSON.parse(v)).buffer) : null;
      };
      PushManager.prototype.getSubscription = async function () {
        return saved() as unknown as PushSubscription;
      };
      PushManager.prototype.subscribe = async function (opts?: PushSubscriptionOptionsInit) {
        const key = new Uint8Array(opts!.applicationServerKey as ArrayBuffer);
        localStorage.setItem(KEY, JSON.stringify([...key]));
        return saved() as unknown as PushSubscription;
      };
    },
    { endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth },
  );
}

const rowFor = async (d: Device) =>
  (await admin.from("push_subscriptions").select("user_id, event_reminders, game_links").eq("endpoint", d.endpoint).maybeSingle()).data;

test("profile: turn notifications on for this device, choose what, turn off; signing out turns them off", async ({ page }) => {
  const member = await createUser();
  const d = device();
  await fakePushManager(page, d);
  await signIn(page, member, "/profile");
  const section = page.getByRole("region", { name: "Notifications" });
  await expect(section.getByText("Get a notification on this device for:")).toBeVisible();

  // Choose before turning on: reminders only.
  await section.getByRole("switch", { name: /Game link is live/ }).uncheck({ force: true });
  await section.getByRole("button", { name: "Turn on notifications" }).click();
  await expect(section.getByText("On for this device. Choose what you get:")).toBeVisible();
  expect(await rowFor(d)).toEqual({ user_id: member.id, event_reminders: true, game_links: false });

  // Change it: saved straight away, and still that way after a reload.
  await section.getByRole("switch", { name: /Game link is live/ }).check({ force: true });
  await expect(section.getByText("Saved.")).toBeVisible();
  expect(await rowFor(d)).toEqual({ user_id: member.id, event_reminders: true, game_links: true });
  await page.reload();
  await expect(section.getByRole("switch", { name: /Game link is live/ })).toBeChecked();
  await expect(section.getByRole("switch", { name: /Event reminders/ })).toBeChecked();

  await section.getByRole("button", { name: "Turn off on this device" }).click();
  await expect(section.getByRole("button", { name: "Turn on notifications" })).toBeVisible();
  expect(await rowFor(d)).toBeNull();

  // On again, then sign out: the device is removed with it.
  await section.getByRole("button", { name: "Turn on notifications" }).click();
  await expect(section.getByText("On for this device. Choose what you get:")).toBeVisible();
  expect(await rowFor(d)).not.toBeNull();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await rowFor(d)).toBeNull();
});

test("a device that changes hands moves to whoever turned notifications on there", async ({ page }) => {
  const [first, second] = await Promise.all([createUser(), createUser()]);
  const d = device();
  await register(first, d);
  await fakePushManager(page, d);
  await signIn(page, second, "/profile");
  const section = page.getByRole("region", { name: "Notifications" });
  // Not the second member's device yet, so it shows as off for them.
  await section.getByRole("button", { name: "Turn on notifications" }).click();
  await expect(section.getByText("On for this device. Choose what you get:")).toBeVisible();
  expect((await rowFor(d))?.user_id).toBe(second.id);
});

test("saving devices: only your own, only from this site, only real push services", async ({ page, request }) => {
  const member = await createUser();
  const other = await createUser();
  const theirs = device();
  await register(other, theirs);

  // Through the database (RLS): can't see or add others' devices, can't insert directly.
  const c = await clientAs(member);
  expect((await c.from("push_subscriptions").select("id")).data).toEqual([]);
  const mine = device();
  expect((await c.from("push_subscriptions").insert({ user_id: member.id, endpoint: mine.endpoint, p256dh: mine.p256dh, auth: mine.auth })).error).not.toBeNull();
  expect((await c.from("push_subscriptions").update({ game_links: false }).eq("endpoint", theirs.endpoint).select("id")).data).toEqual([]);
  expect((await c.from("push_subscriptions").delete().eq("endpoint", theirs.endpoint).select("id")).data).toEqual([]);
  expect(await rowFor(theirs)).toEqual({ user_id: other.id, event_reminders: true, game_links: true });

  // The service worker's re-subscribe endpoint.
  const body = (sub: unknown) => ({ subscription: sub, replaces: null });
  const json = (d: Device) => ({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } });
  expect((await request.post("/api/push/subscription", { data: body(json(mine)), headers: { Origin: "https://evil.example" } })).status()).toBe(403);
  expect((await request.post("/api/push/subscription", { data: body(json(mine)), headers: { Origin: "http://localhost:3200" } })).status()).toBe(401);

  await signIn(page, member, "/profile");
  const post = (data: unknown, headers: Record<string, string> = { Origin: "http://localhost:3200" }) =>
    page.request.post("/api/push/subscription", { data, headers });
  // Not JSON (what another site's form could send): refused.
  expect(
    (await page.request.post("/api/push/subscription", { form: { subscription: "x" }, headers: { Origin: "http://localhost:3200" } })).status(),
  ).toBe(403);
  // Somewhere that isn't a push service: refused, nothing saved.
  const evil = { endpoint: "https://evil.example/collect", keys: { p256dh: mine.p256dh, auth: mine.auth } };
  expect((await post(body(evil))).status()).toBe(400);
  expect((await admin.from("push_subscriptions").select("id").eq("endpoint", evil.endpoint)).data).toEqual([]);
  // A real one, replacing a rotated one: the old one's settings carry over.
  const old = device();
  await register(member, old, { event_reminders: false });
  expect((await post({ subscription: json(mine), replaces: old.endpoint })).status()).toBe(200);
  expect(await rowFor(old)).toBeNull();
  expect(await rowFor(mine)).toEqual({ user_id: member.id, event_reminders: false, game_links: true });
});
