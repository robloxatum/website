// 10. Layout: at 390, 768, 1024, 1280 and 1440px nothing overflows sideways or
//     sits under a fixed bar. 11. Accessibility: axe, no serious/critical issues.
// Every page from the flows above, as the visitor who'd see it, with a live
// event (checked in, two game servers posted, RSVP'd) and an announcement showing.
import { admin, checkInAs, createEvent, createUser, rsvpAs, SEEDED, type TestEvent, type TestUser } from "./support/db";
import { expect, expectAccessible, expectLayoutOk, signIn, test } from "./support/fixtures";

let live: TestEvent;
let member: TestUser;

test.beforeAll(async () => {
  live = await createEvent({ title: "Layout Check Game Night With A Rather Long Title To Wrap", open: true, capacity: 40 });
  member = await createUser({ fullName: "Lena Layout", nickname: "Lena" });
  expect(await checkInAs(member, live.code)).toBe("ok");
  await rsvpAs(member, live.id);
  const { error: serversError } = await admin.from("event_game_servers").insert([
    { event_id: live.id, url: "https://www.roblox.com/share?code=layout&type=Server", label: "Server 1", position: 0, is_full: false },
    { event_id: live.id, url: "https://www.roblox.com/share?code=layout2&type=Server", label: "Overflow with a longer label", position: 1, is_full: true },
  ]);
  expect(serversError).toBeNull();
  await admin.from("announcements").delete().not("id", "is", null);
  await admin.from("announcements").insert({ message: "Game night moved to BBB 1670 tonight, bring a friend!", link: "/events", style: "urgent" });
});

test.afterAll(async () => {
  await admin.from("announcements").delete().not("id", "is", null);
});

async function check(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expectLayoutOk(page, path);
  await expectAccessible(page, path);
}

const PUBLIC = ["/", "/join", "/events", "EVENT", "/links", "/privacy", "/about", "/login", "/install", "/this-page-does-not-exist"];
const MEMBER = ["/", "/events", "EVENT", "/checkin", "/play", "/profile", "/join/done", "/officer"];
const OFFICER = [
  "/officer",
  "/officer/events",
  "/officer/events/new",
  "/officer/events/EVENT",
  "/officer/members",
  "/officer/announcement",
  "/officer/content",
  "/officer/analytics",
  "/officer/flyer",
  "/officer/events/EVENT/present",
];
const path = (p: string) => (p === "EVENT" ? `/events/${live.id}` : p.replace("EVENT", live.id));

test.describe("visitor", () => {
  for (const p of PUBLIC) test(p, async ({ page }) => check(page, path(p)));
});

test.describe("member", () => {
  for (const p of MEMBER) {
    test(p, async ({ page }) => {
      await signIn(page, member, "/");
      await check(page, path(p));
    });
  }
  test("check-in result screen", async ({ page }) => {
    await signIn(page, member, `/checkin?code=${live.code}`);
    await expect(page.getByRole("heading", { name: "Already checked in" })).toBeVisible();
    await expectLayoutOk(page, "check-in result");
    await expectAccessible(page, "check-in result");
  });
});

test.describe("new member", () => {
  test("/welcome", async ({ page }) => {
    await signIn(page, await createUser({ onboarded: false, fullName: "Wes Welcome" }), "/");
    await expect(page).toHaveURL(/\/welcome/);
    await page.waitForLoadState("networkidle");
    await expectLayoutOk(page, "/welcome");
    await expectAccessible(page, "/welcome");
  });
});

test.describe("officer", () => {
  for (const p of OFFICER) {
    test(p, async ({ page }) => {
      await signIn(page, SEEDED.officer, "/");
      await check(page, path(p));
    });
  }
});
