// 5. Events: officers create, edit and delete; the public event page and the
//    lists change immediately (location change test).
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { SEEDED } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

/** "YYYY-MM-DDTHH:mm" in Ann Arbor time, for datetime-local inputs. */
function clubInput(date: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

async function publicLocation(page: Page, id: string) {
  await page.goto(`/events/${id}`);
  return page.locator("dl").first().innerText();
}

test("create → edit location → delete: public page and lists follow immediately", async ({ page, browser, pageErrors }) => {
  const title = `E2E Workshop ${randomUUID().slice(0, 6)}`;
  const start = new Date(Date.now() + 2 * 24 * 3600_000);
  start.setMinutes(0, 0, 0);

  const officer = await browser.newPage({ viewport: page.viewportSize()! });
  await signIn(officer, SEEDED.officer, "/officer/events/new");
  await officer.getByLabel("Title").fill(title);
  await officer.getByLabel("Starts").fill(clubInput(start));
  await officer.getByLabel("Ends").fill(clubInput(new Date(start.getTime() + 2 * 3600_000)));
  await officer.getByLabel("Location").fill("Room Alpha 100");
  await officer.getByLabel("Description").fill("Bring a laptop.");
  await officer.getByRole("button", { name: "Create event" }).click();
  await expect(officer).toHaveURL(/\/officer\/events\/[0-9a-f-]{36}\?saved=1$/);
  const id = officer.url().match(/events\/([0-9a-f-]{36})/)![1];

  // Visitors see it straight away (page and lists).
  expect(await publicLocation(page, id)).toContain("Room Alpha 100");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  // (Home shows only the next three events, the same cached list as /events.)
  await page.goto("/events");
  await expect(page.getByText(title).first()).toBeVisible();

  // Edit the location: the very next visit shows it.
  await officer.getByLabel("Location").fill("Room Beta 200");
  // Wait for the save itself (the URL already ends in ?saved=1 from creating it).
  await Promise.all([
    officer.waitForResponse((r) => r.request().method() === "POST" && r.url().includes(`/officer/events/${id}`)),
    officer.getByRole("button", { name: "Save changes" }).click(),
  ]);
  const after = await publicLocation(page, id);
  expect(after).toContain("Room Beta 200");
  expect(after).not.toContain("Room Alpha 100");
  await page.goto("/events");
  await expect(page.locator("main")).toContainText("Room Beta 200");

  // Delete: gone from the page and the lists.
  officer.once("dialog", (d) => d.accept());
  await officer.getByRole("button", { name: "Delete event" }).click();
  await expect(officer).toHaveURL(/\/officer$/);
  await page.goto(`/events/${id}`);
  await expect(page.getByText(/Block not found/)).toBeVisible();
  // The 404 is decided inside the page's Suspense boundary (as Next documents for
  // streamed pages), so right after a delete React may log #419 ("server couldn't
  // finish this boundary") while still showing the 404. Allowed here only.
  await page.waitForLoadState("networkidle");
  const n = pageErrors.length;
  pageErrors.splice(0, n, ...pageErrors.slice(0, n).filter((e) => !/React error #419/.test(e)));
  await page.goto("/events");
  await expect(page.getByText(title)).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByText(title)).toHaveCount(0);
  await officer.close();
});

test("the event form refuses an end before the start", async ({ page }) => {
  const start = new Date(Date.now() + 3 * 24 * 3600_000);
  await signIn(page, SEEDED.officer, "/officer/events/new");
  await page.getByLabel("Title").fill("Backwards");
  await page.getByLabel("Starts").fill(clubInput(start));
  await page.getByLabel("Ends").fill(clubInput(new Date(start.getTime() - 3600_000)));
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/officer\/events\/new/);
  await expect(page.getByText(/end.*after.*start|ends before it starts|after the start/i).first()).toBeVisible();
  // Regression: what the officer typed is still there to fix (React resets forms after an action).
  await expect(page.getByLabel("Title")).toHaveValue("Backwards");
  await expect(page.getByLabel("Starts")).toHaveValue(clubInput(start));
});

test("members and visitors can't open the officer event pages", async ({ page }) => {
  await page.goto("/officer/events/new");
  await expect(page).toHaveURL(/\/login\?next=/);
  await signIn(page, SEEDED.member, "/officer/events/new");
  await expect(page.getByRole("heading", { name: "Officers only" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveCount(0);
});
