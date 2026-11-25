// 2. Check-in: officer opens it; members check in by code and by QR URL; wrong-code
//    rate limit; closed and ended events refuse; the Present page count is live.
import { attendanceCount, checkInAs, clientAs, createEvent, createUser, SEEDED } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

const codeBox = (page: import("@playwright/test").Page) => page.getByLabel("Enter the 5-letter code");

test("officer opens check-in; a member checks in by typing the code", async ({ page, browser }) => {
  const event = await createEvent({ open: false });
  const officer = await browser.newPage({ viewport: page.viewportSize()! });
  await signIn(officer, SEEDED.officer, `/officer/events/${event.id}`);
  await expect(officer.getByText(event.code)).toBeVisible();
  await officer.getByRole("button", { name: "Open check-in" }).click();
  await expect(officer.getByText(/^Open · closes/)).toBeVisible();
  await officer.close();

  const member = await createUser({ nickname: "Cody" });
  await signIn(page, member, "/checkin");
  await expect(page.getByText("Hey Cody!")).toBeVisible();
  await codeBox(page).fill(event.code.toLowerCase());
  await expect(page.getByRole("heading", { name: "You're checked in!" })).toBeVisible();
  await expect(page.getByText(event.title)).toBeVisible();
  expect(await attendanceCount(event.id)).toBe(1);

  // Again: already on the list.
  await page.goto("/checkin");
  await codeBox(page).fill(event.code);
  await expect(page.getByRole("heading", { name: "Already checked in" })).toBeVisible();
});

test("the QR URL checks in straight away, and drops the code from the URL", async ({ page }) => {
  const event = await createEvent({ open: true });
  const member = await createUser();
  await signIn(page, member, `/checkin?code=${event.code}`);
  await expect(page.getByRole("heading", { name: "You're checked in!" })).toBeVisible();
  await expect(page).toHaveURL(/\/checkin$/);
  expect(await attendanceCount(event.id)).toBe(1);
});

test("signed out, the QR URL goes to sign-in and keeps the code", async ({ page }) => {
  const event = await createEvent({ open: true });
  await page.goto(`/checkin?code=${event.code}`);
  await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(`/checkin?code=${event.code}`).replace(/[?]/g, "\\?")}`));
});

test("wrong codes are rate limited after 10 tries", async ({ page }) => {
  const member = await createUser();
  const c = await clientAs(member);
  for (let i = 0; i < 9; i++) await c.rpc("check_in", { p_code: "ZZZZZ" });
  await signIn(page, member, "/checkin");
  await codeBox(page).fill("ZZZZZ");
  await expect(page.getByRole("heading", { name: "That code didn't work" })).toBeVisible();
  await page.getByRole("button", { name: "Try another code" }).click();
  // Even a right code is refused now.
  const event = await createEvent({ open: true });
  await codeBox(page).fill(event.code);
  await expect(page.getByRole("heading", { name: "Too many tries" })).toBeVisible();
  expect(await attendanceCount(event.id)).toBe(0);
});

test("closed and ended events refuse check-in", async ({ page }) => {
  const closed = await createEvent({ open: false });
  const ended = await createEvent({ open: true, startMin: -120, endMin: -5 });
  const member = await createUser();
  await signIn(page, member, "/checkin");
  await codeBox(page).fill(closed.code);
  await expect(page.getByRole("heading", { name: "Check-in is closed" })).toBeVisible();
  await page.getByRole("button", { name: "Try another code" }).click();
  await codeBox(page).fill(ended.code);
  await expect(page.getByRole("heading", { name: "Check-in is closed" })).toBeVisible();
  expect(await attendanceCount(closed.id)).toBe(0);
  expect(await attendanceCount(ended.id)).toBe(0);
});

test("the Present page count updates live as members check in", async ({ page }) => {
  const event = await createEvent({ open: true, capacity: 30 });
  await signIn(page, SEEDED.officer, `/officer/events/${event.id}/present`);
  const count = page.locator("p[aria-live=polite]").filter({ hasText: /^\d+$/ });
  await expect(count).toHaveText("0");
  expect(await checkInAs(await createUser(), event.code)).toBe("ok");
  // Well inside the 15 s fallback poll: this is the Realtime broadcast.
  await expect(count).toHaveText("1", { timeout: 8_000 });
  expect(await checkInAs(await createUser(), event.code)).toBe("ok");
  await expect(count).toHaveText("2", { timeout: 8_000 });
});
