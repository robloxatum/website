// 18. Design review 2: the phone Check In button (navy, yellow on event day),
//     event-page facts on phones, card "Details" links on phones, Join page
//     wording and FAQ, and the home page without the Featured panel.
import type { Locator, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createEvent, SEEDED } from "./support/db";
import { expect, expectLayoutOk, isPhone, signIn, test } from "./support/fixtures";

const DAY = 24 * 3600_000;
const box = async (l: Locator) => (await l.boundingBox())!;

/** "YYYY-MM-DDTHH:mm" in Ann Arbor time, for datetime-local inputs. */
function clubInput(date: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Created in the officer form, so the cached event lists (home, tab bar) pick it up straight away. */
async function officerCreatesEvent(page: Page, start: Date, minutes: number) {
  await signIn(page, SEEDED.officer, "/officer/events/new");
  const title = `E2E Review2 ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Starts").fill(clubInput(start));
  await page.getByLabel("Ends").fill(clubInput(new Date(start.getTime() + minutes * 60_000)));
  await page.getByLabel("Location").fill("BBB 1670");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/officer\/events\/[0-9a-f-]{36}\?saved=1$/);
  return title;
}

async function setFeatured(page: Page, on: boolean) {
  await signIn(page, SEEDED.officer, "/officer/content");
  const featured = page.locator("section").filter({ has: page.getByRole("heading", { name: "Featured panel", exact: true }) });
  const toggle = featured.getByRole("switch");
  if ((await toggle.isChecked()) === on) return;
  await toggle.setChecked(on, { force: true }); // the input is visually hidden behind its switch
  await featured.getByRole("button", { name: "Save" }).click();
  await expect(featured.getByText("Saved. It's live on the site now.")).toBeVisible();
}

test("phone Check In: navy with a yellow icon, yellow from 2 hours before an event until it ends; desktop unchanged", async ({ page, browser }) => {
  // Starts in an hour: inside the check-in window.
  await officerCreatesEvent(page, new Date(Date.now() + 60 * 60_000), 120);
  const visitor = await browser.newPage({ viewport: page.viewportSize()! });
  try {
    await visitor.goto("/");
    if (!isPhone(page)) {
      // Desktop: the header button as before (outline for visitors), no tab bar.
      const header = visitor.locator("header").first();
      await expect(header.getByRole("link", { name: "Check In" })).toBeVisible();
      await expect(header.getByRole("link", { name: "Check In" })).not.toHaveClass(/bg-maize/);
      await expect(visitor.getByRole("navigation").getByRole("link", { name: "Check In", exact: true })).toBeHidden();
      return;
    }
    const tab = visitor.getByRole("navigation").getByRole("link", { name: "Check In", exact: true });
    const button = tab.locator("span").first();
    await expect(tab).toHaveAttribute("data-highlight", "true");
    await expect(button).toHaveClass(/bg-maize/);
    await visitor.screenshot({ path: test.info().outputPath("tab-event-day.png") });

    // Long after every test event: no check-in window open, so navy with a yellow icon.
    await visitor.clock.setFixedTime(new Date(Date.now() + 400 * DAY));
    await visitor.reload();
    await expect(tab).toBeVisible();
    await expect(tab).not.toHaveAttribute("data-highlight");
    await expect(button).toHaveClass(/bg-navy/);
    await expect(button).not.toHaveClass(/bg-maize/);
    expect(await tab.locator("svg").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(240, 196, 19)");
    await visitor.screenshot({ path: test.info().outputPath("tab-normal.png") });
  } finally {
    await visitor.close();
  }
});

test("event page on phones: date and time share a row, the location card opens the map", async ({ page }) => {
  const event = await createEvent({ startMin: 60 * 24 * 4, endMin: 60 * 24 * 4 + 120, location: "CCCB 1420" });
  await page.goto(`/events/${event.id}`);
  const fact = (name: string) => page.locator("main article dl > div").filter({ hasText: name });
  await expect(fact("Location")).toContainText("Central Campus Classroom Building"); // streamed in
  for (const name of ["Date", "Time", "Location"]) await expect(fact(name)).toBeVisible();
  const [date, time, location] = [await box(fact("Date")), await box(fact("Time")), await box(fact("Location"))];
  expect(Math.abs(date.y - time.y)).toBeLessThan(2); // one row (also on desktop, as before)
  expect(time.x).toBeGreaterThan(date.x);
  if (isPhone(page)) {
    expect(location.y).toBeGreaterThan(date.y + date.height - 1); // its own row, full width
    expect(location.width).toBeGreaterThan(date.width * 1.8);
    // The RSVP button is right under the facts, within the first screen.
    const rsvp = page.getByTestId("primary-actions").getByRole("link", { name: "RSVP with umich" });
    expect((await box(rsvp)).y + (await box(rsvp)).height).toBeLessThan(page.viewportSize()!.height);
  }
  // Anywhere on the card is the map link (not just the word "Map").
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.getAttribute("href") ?? null,
    [location.x + location.width - 8, location.y + location.height / 2],
  );
  expect(hit).toMatch(/^https:\/\/www\.google\.com\/maps\//);
  await page.screenshot({ path: test.info().outputPath("event-facts.png") });
  await expectLayoutOk(page, "event page facts");
});

test("event cards show 'Details →' on phones too (Events page and Home)", async ({ page }) => {
  await officerCreatesEvent(page, new Date(Date.now() + 3 * DAY), 90);
  await page.context().clearCookies();
  for (const path of ["/events", "/"]) {
    await page.goto(path);
    // Home shows the three soonest (often other tests' live events); every one has Details.
    const cards = page.locator("main a[href^='/events/']");
    const card = path === "/" ? cards.first() : cards.filter({ hasText: "E2E Review2" }).first();
    await expect(card.getByText("Details", { exact: true }), path).toBeVisible();
  }
});

test("Join page: 'A typical event', FAQ minus when open, Events page link, the Roblox question, helper line", async ({ page }) => {
  await page.goto("/join");
  const main = page.locator("main"); // not the streamed copy React swaps in
  await expect(main.getByText("A typical event", { exact: true })).toBeVisible();
  await expect(main.getByText("A typical meeting")).toHaveCount(0);

  const helper = main.getByText("After that, RSVP and check-in take one tap.", { exact: true });
  await expect(helper).toBeVisible();
  const style = await helper.evaluate((el) => ({ size: getComputedStyle(el).fontSize, color: getComputedStyle(el).color }));
  expect(style.size).toBe("14px");
  expect(style.color).toBe("rgb(169, 190, 208)"); // fg-2

  const roblox = main.locator("details").filter({ hasText: "Are you part of Roblox?" });
  await expect(roblox).toHaveCount(1);
  await roblox.locator("summary").click();
  await expect(roblox).toContainText(
    "No. We're an independent student org. Roblox has partnered with us on events like our game jams and Player to Pro.",
  );
  await expect(roblox.locator("svg.lucide-minus")).toBeVisible();
  await expect(roblox.locator("svg.lucide-plus")).toBeHidden();
  const closed = main.locator("details:not([open])").first();
  await expect(closed.locator("svg.lucide-plus")).toBeVisible();
  await expect(closed.locator("svg.lucide-minus")).toBeHidden();

  const where = main.locator("details").filter({ hasText: "When and where do you meet?" });
  await where.locator("summary").click();
  await expect(where.getByRole("link", { name: "Events page" })).toHaveAttribute("href", "/events");
  await page.screenshot({ path: test.info().outputPath("join.png"), fullPage: true });
});

test("home without the Featured panel: Upcoming Events takes the full width", async ({ page, browser }) => {
  await setFeatured(page, false);
  const visitor = await browser.newPage({ viewport: page.viewportSize()! });
  try {
    await visitor.goto("/");
    await expect(visitor.getByText("Featured", { exact: true })).toHaveCount(0);
    const panel = visitor.locator("section").filter({ has: visitor.getByRole("heading", { name: "Upcoming Events" }) });
    const banner = visitor.locator("main section").filter({ hasText: "Build · Create · Connect" });
    const [p, b] = [await box(panel), await box(banner)];
    expect(Math.abs(p.width - b.width)).toBeLessThan(2);
    expect(Math.abs(p.x - b.x)).toBeLessThan(2);
    // Three or more upcoming: three across on desktop.
    const items = panel.locator("ul > li");
    if (!isPhone(page) && (await items.count()) === 3) {
      const tops = await Promise.all((await items.all()).map(async (l) => (await box(l)).y));
      expect(new Set(tops.map(Math.round)).size).toBe(1);
    }
    await visitor.screenshot({ path: test.info().outputPath("home-no-featured.png"), fullPage: true });
    await expectLayoutOk(visitor, "home without featured");
  } finally {
    await visitor.close();
    await setFeatured(page, true);
  }
});
