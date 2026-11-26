// 3. Game servers + nav: officers add / edit / reorder / mark full / remove
//    several servers; a checked-in member sees them live (one server looks like
//    the single Join button, several are a list with a suggestion); others never
//    get a link; the present page only counts them; all of it hides at the end.
import type { Browser, Page } from "@playwright/test";
import { admin, checkInAs, clientAs, createEvent, createUser, SEEDED, type TestUser } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

const LINK_1 = "https://www.roblox.com/share?code=e2eaaa111&type=Server";
const LINK_2 = "https://www.roblox.com/share?code=e2ebbb222&type=Server";
const LINK_3 = "https://www.roblox.com/share?code=e2eccc333&type=Server";

async function officerPage(browser: Browser, like: Page, eventId: string) {
  const p = await browser.newPage({ viewport: like.viewportSize()!, isMobile: false });
  await signIn(p, SEEDED.officer, `/officer/events/${eventId}`);
  return p;
}

const officerList = (officer: Page) => officer.getByRole("list", { name: /Game servers/ });

async function addServer(officer: Page, url: string, label?: string) {
  await officer.getByRole("button", { name: /^(Post a link|Add a server)$/ }).click();
  await officer.getByLabel("Roblox private server link").fill(url);
  if (label) await officer.getByLabel(/^Label/).fill(label);
  await officer.getByRole("button", { name: "Add server" }).click();
  await expect(officer.getByRole("button", { name: "Add server" })).toHaveCount(0);
  if (label) await expect(officerList(officer)).toContainText(label);
}

/** Adds servers directly (as the test runner); throws if the insert fails. */
async function seed(rows: Record<string, unknown> | Record<string, unknown>[]) {
  const { error } = await admin.from("event_game_servers").insert(rows);
  if (error) throw new Error(`seed servers: ${error.message}`);
}

const playLink = (page: Page) => page.getByRole("link", { name: /^Play/ });
const memberList = (page: Page) => page.getByRole("list", { name: "Game servers" });
const joinLink = (page: Page, label: string) => page.getByRole("link", { name: new RegExp(`^Join ${label}( Suggested for you)?$`) });

test("officer adds, marks full, edits, reorders and removes servers; the member sees each change live", async ({ page, browser }) => {
  const event = await createEvent({ open: true });
  const member = await createUser();
  expect(await checkInAs(member, event.code)).toBe("ok"); // first in: suggested the first open server

  await signIn(page, member, "/play");
  await expect(playLink(page)).toBeVisible();
  await expect(playLink(page)).not.toContainText("game link posted");
  await expect(page.getByText("Waiting for the game link…")).toBeVisible();

  const officer = await officerPage(browser, page, event.id);
  await expect(officer.getByText("No game link yet")).toBeVisible();

  // One server: today's single Join button. No reload: Realtime tells the member's page.
  await addServer(officer, LINK_1, "Server 1");
  await expect(officer.getByText("Game link is live")).toBeVisible();
  await expect(page.getByRole("link", { name: "Join the game" })).toHaveAttribute("href", LINK_1, { timeout: 10_000 });
  await expect(page.getByText("Server 1")).toBeVisible();
  await expect(playLink(page)).toContainText("game link posted");

  // Two servers: a list, with a suggestion for this member.
  await addServer(officer, LINK_2, "Team Red");
  await expect(officer.getByText("2 servers live")).toBeVisible();
  await expect(joinLink(page, "Team Red")).toHaveAttribute("href", LINK_2, { timeout: 10_000 });
  await expect(page.getByRole("link", { name: "Join the game" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Join Server 1 Suggested for you" })).toHaveAttribute("href", LINK_1);
  await expect(memberList(page).getByText("Suggested for you")).toBeVisible();

  // Mark Server 1 full: greyed out, no link, "try another"; nothing left to suggest.
  await officer.getByRole("button", { name: "Mark Server 1 full" }).click();
  await expect(officer.getByRole("button", { name: "Mark Server 1 open" })).toBeVisible();
  await expect(memberList(page).getByText("Full — try another")).toBeVisible({ timeout: 10_000 });
  await expect(joinLink(page, "Server 1")).toHaveCount(0);
  await expect(joinLink(page, "Team Red")).toBeVisible();
  await expect(page.getByText("Suggested for you")).toHaveCount(0);
  expect(await page.content()).not.toContain("e2eaaa111");

  // Edit Team Red: new link and label.
  await officer.getByRole("button", { name: "Edit Team Red" }).click();
  await officer.getByLabel("Roblox private server link").fill(LINK_3);
  await officer.getByLabel(/^Label/).fill("Overflow");
  await officer.getByRole("button", { name: "Save server" }).click();
  await expect(officerList(officer)).toContainText("Overflow");
  await expect(joinLink(page, "Overflow")).toHaveAttribute("href", LINK_3, { timeout: 10_000 });
  await expect(joinLink(page, "Team Red")).toHaveCount(0);

  // Reorder: Overflow moves to the top for members too.
  await officer.getByRole("button", { name: "Move Overflow up" }).click();
  await expect(officerList(officer).getByRole("listitem").first()).toContainText("Overflow");
  await expect(memberList(page).getByRole("listitem").first()).toContainText("Overflow", { timeout: 10_000 });

  // Remove the full one: back to a single Join button.
  officer.once("dialog", (d) => d.accept());
  await officer.getByRole("button", { name: "Remove Server 1" }).click();
  await expect(officer.getByText("Game link is live")).toBeVisible();
  await expect(page.getByRole("link", { name: "Join the game" })).toHaveAttribute("href", LINK_3, { timeout: 10_000 });
  await expect(memberList(page)).toHaveCount(0);

  // Remove the last one: waiting again, no dot.
  officer.once("dialog", (d) => d.accept());
  await officer.getByRole("button", { name: "Remove Overflow" }).click();
  await expect(officer.getByText("No game link yet")).toBeVisible();
  await expect(page.getByText("Waiting for the game link…")).toBeVisible({ timeout: 10_000 });
  await expect(playLink(page)).not.toContainText("game link posted");
  await officer.close();
});

test("only roblox.com links can be added", async ({ page }) => {
  const event = await createEvent({ open: true });
  await signIn(page, SEEDED.officer, `/officer/events/${event.id}`);
  await page.getByRole("button", { name: "Post a link" }).click();
  await page.getByLabel("Roblox private server link").fill("https://roblox.com.evil.example/share?code=x");
  await page.getByRole("button", { name: "Add server" }).click();
  await expect(page.getByText("Only roblox.com links can be posted.")).toBeVisible();
  await expect(page.getByText("No game link yet")).toBeVisible();
});

test("a member who isn't checked in never gets a link", async ({ page }) => {
  const event = await createEvent({ open: true });
  await seed([
    { event_id: event.id, url: LINK_1, label: "Server 1", position: 0, is_full: false },
    { event_id: event.id, url: LINK_2, label: "Server 2", position: 1, is_full: false },
  ]);

  const outsider: TestUser = await createUser();
  await signIn(page, outsider, "/play");
  await expect(page.getByText(/You need to check in to the event first/)).toBeVisible();
  await expect(page.getByRole("link", { name: /^Check In$/ })).toBeVisible();
  await expect(playLink(page)).toHaveCount(0);
  expect(await page.content()).not.toContain("e2eaaa111");

  // And the database won't hand them over either (RLS).
  const c = await clientAs(outsider);
  const { data } = await c.from("event_game_servers").select("url").eq("event_id", event.id);
  expect(data ?? []).toEqual([]);
  const { data: order } = await c.rpc("my_checkin_order", { p_event_id: event.id });
  expect(order).toBeNull();

  // Signed out: same.
  await page.context().clearCookies();
  await page.goto("/play");
  await expect(page.getByRole("link", { name: "Sign in" }).last()).toBeVisible();
  expect(await page.content()).not.toContain("e2eaaa111");
});

test("the present page counts live servers and never shows a link", async ({ page }) => {
  const event = await createEvent({ open: true });
  await seed([
    { event_id: event.id, url: LINK_1, label: "Server 1", position: 0, is_full: false },
    { event_id: event.id, url: LINK_2, label: "Server 2", position: 1, is_full: true },
  ]);
  await signIn(page, SEEDED.officer, `/officer/events/${event.id}/present`);
  await expect(page.getByText("2 servers live")).toBeVisible();
  await expect(page.getByText(/On your laptop: localhost:\d+\/play$/)).toBeVisible();
  await expect(page.getByText("· 1 full")).toBeVisible();
  // A third server goes up elsewhere: the count follows live.
  await seed({ event_id: event.id, url: LINK_3, label: "Server 3", position: 2, is_full: false });
  await expect(page.getByText("3 servers live")).toBeVisible({ timeout: 10_000 });
  const html = await page.content();
  for (const code of ["e2eaaa111", "e2ebbb222", "e2eccc333"]) expect(html).not.toContain(code);
});

test("servers hide when the event ends, and Play turns back into Check In", async ({ page }) => {
  const event = await createEvent({ open: true, startMin: -30, endSec: 25 });
  const member = await createUser();
  expect(await checkInAs(member, event.code)).toBe("ok");
  await seed([
    { event_id: event.id, url: LINK_1, label: "Server 1", position: 0, is_full: false },
    { event_id: event.id, url: LINK_2, label: "Server 2", position: 1, is_full: false },
  ]);
  await signIn(page, member, "/play");
  await expect(joinLink(page, "Server 2")).toBeVisible();
  await expect(playLink(page)).toContainText("game link posted");

  await expect(memberList(page)).toHaveCount(0, { timeout: 45_000 });
  await expect(page.getByRole("link", { name: /^Join (the game|Server)/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Check In$/ })).toBeVisible({ timeout: 15_000 });
  await expect(playLink(page)).toHaveCount(0);

  // The database stops handing them over too.
  const c = await clientAs(member);
  const { data } = await c.from("event_game_servers").select("url").eq("event_id", event.id);
  expect(data ?? []).toEqual([]);
});
