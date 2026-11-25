// 3. Game links + nav: officer posts / replaces / clears; a checked-in member sees
//    Play (with the dot) live; others never get the link; Play reverts after the end.
import type { Browser, Page } from "@playwright/test";
import { checkInAs, clientAs, createEvent, createUser, SEEDED, type TestUser } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

const LINK_1 = "https://www.roblox.com/share?code=e2eaaa111&type=Server";
const LINK_2 = "https://www.roblox.com/share?code=e2ebbb222&type=Server";

async function officerPage(browser: Browser, like: Page, eventId: string) {
  const p = await browser.newPage({ viewport: like.viewportSize()!, isMobile: false });
  await signIn(p, SEEDED.officer, `/officer/events/${eventId}`);
  return p;
}

async function postLink(officer: Page, url: string, label?: string) {
  await officer.getByRole("button", { name: /Post a link|Replace link/ }).first().click();
  await officer.getByLabel("Roblox private server link").fill(url);
  if (label) await officer.getByLabel(/^Label/).fill(label);
  await officer.getByRole("button", { name: /^(Post link|Replace link)$/ }).last().click();
  await expect(officer.getByText(/Game link is live/)).toBeVisible();
}

const playLink = (page: Page) => page.getByRole("link", { name: /^Play/ });

test("checked-in member: Play appears, the dot and the link arrive live, replace and clear too", async ({ page, browser }) => {
  const event = await createEvent({ open: true });
  const member = await createUser();
  expect(await checkInAs(member, event.code)).toBe("ok");

  await signIn(page, member, "/play");
  await expect(playLink(page)).toBeVisible();
  await expect(playLink(page)).not.toContainText("game link posted");
  await expect(page.getByText("Waiting for the game link…")).toBeVisible();

  const officer = await officerPage(browser, page, event.id);
  await postLink(officer, LINK_1, "Server 1");
  // No reload: Realtime tells the member's page.
  await expect(page.getByRole("link", { name: "Join the game" })).toHaveAttribute("href", LINK_1, { timeout: 10_000 });
  await expect(page.getByText("Server 1")).toBeVisible();
  await expect(playLink(page)).toContainText("game link posted");

  await postLink(officer, LINK_2);
  await expect(page.getByRole("link", { name: "Join the game" })).toHaveAttribute("href", LINK_2, { timeout: 10_000 });

  officer.once("dialog", (d) => d.accept());
  await officer.getByRole("button", { name: "Clear" }).click();
  await expect(officer.getByText("No game link yet")).toBeVisible();
  await expect(page.getByText("Waiting for the game link…")).toBeVisible({ timeout: 10_000 });
  await expect(playLink(page)).not.toContainText("game link posted");
  await officer.close();
});

test("a member who isn't checked in never gets the link", async ({ page, browser }) => {
  const event = await createEvent({ open: true });
  const officer = await officerPage(browser, page, event.id);
  await postLink(officer, LINK_1);
  await officer.close();

  const outsider: TestUser = await createUser();
  await signIn(page, outsider, "/play");
  await expect(page.getByText(/You need to check in to the event first/)).toBeVisible();
  await expect(page.getByRole("link", { name: /^Check In$/ })).toBeVisible();
  await expect(playLink(page)).toHaveCount(0);
  expect(await page.content()).not.toContain("e2eaaa111");

  // And the database won't hand it over either (RLS).
  const c = await clientAs(outsider);
  const { data } = await c.from("event_game_links").select("url").eq("event_id", event.id);
  expect(data ?? []).toEqual([]);

  // Signed out: same.
  await page.context().clearCookies();
  await page.goto("/play");
  await expect(page.getByRole("link", { name: "Sign in" }).last()).toBeVisible();
  expect(await page.content()).not.toContain("e2eaaa111");
});

test("Play turns back into Check In when the event ends", async ({ page }) => {
  const event = await createEvent({ open: true, startMin: -30, endSec: 25 });
  const member = await createUser();
  expect(await checkInAs(member, event.code)).toBe("ok");
  await signIn(page, member, "/events");
  await expect(playLink(page)).toBeVisible();
  await expect(page.getByRole("link", { name: /^Check In$/ })).toBeVisible({ timeout: 45_000 });
  await expect(playLink(page)).toHaveCount(0);
});
