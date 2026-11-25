// 4. RSVP: toggle on/off; counts only in officer views; the CSV lists RSVP'd no-shows.
import { checkInAs, createEvent, createUser, rsvpAs } from "./support/db";
import { SEEDED } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

test("a member RSVPs and un-RSVPs; it sticks across reloads", async ({ page }) => {
  const event = await createEvent({ startMin: 60 * 24 * 3, endMin: 60 * 24 * 3 + 120 });
  await page.goto(`/events/${event.id}`);
  await expect(page.getByRole("link", { name: "Sign in to RSVP" })).toBeVisible();

  const member = await createUser();
  await signIn(page, member, `/events/${event.id}`);
  const toggle = page.getByRole("button", { name: /I.m going/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("RSVP counts show only to officers; the CSV includes RSVP'd no-shows", async ({ page, browser }) => {
  const event = await createEvent({ open: true, capacity: 20 });
  const came = await createUser({ fullName: "Cara Came" });
  const noShow = await createUser({ fullName: "Ned Noshow" });
  await rsvpAs(came, event.id);
  await rsvpAs(noShow, event.id);
  expect(await checkInAs(came, event.code)).toBe("ok");

  // Public views: no RSVP numbers, no names.
  for (const path of [`/events/${event.id}`, "/events", "/"]) {
    await page.goto(path);
    const text = await page.locator("main").innerText();
    expect(text, path).not.toMatch(/going \(RSVP\)|\bRSVPs?\b\s*\d|Ned Noshow/);
  }

  const officer = await browser.newPage();
  await signIn(officer, SEEDED.officer, "/officer/events");
  const card = officer.locator("article, li").filter({ has: officer.getByText(event.title, { exact: true }) }).last();
  await expect(card).toContainText(/2\s*\/\s*20\s*going/);
  await officer.goto(`/officer/events/${event.id}`);
  await expect(officer.getByRole("heading", { name: /RSVPs/ })).toContainText("2");

  const res = await officer.request.get(`/officer/events/${event.id}/attendance.csv`);
  expect(res.status()).toBe(200);
  const rows = (await res.text()).replace(/^﻿/, "").trim().split(/\r?\n/);
  expect(rows[0]).toContain("RSVP");
  const line = (name: string) => rows.find((r) => r.includes(name)) ?? "";
  const cells = (r: string) => [...r.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1]);
  // Columns: ..., Checked in, Checked in at, RSVP
  expect(cells(line("Cara Came")).slice(-3)).toEqual(["Yes", expect.any(String), "Yes"]);
  expect(cells(line("Ned Noshow")).slice(-3)).toEqual(["No", "", "Yes"]); // RSVP'd, didn't come
  await officer.close();

  // Members can't download it.
  await signIn(page, came, "/");
  const denied = await page.request.get(`/officer/events/${event.id}/attendance.csv`);
  expect(denied.status()).toBeGreaterThanOrEqual(400);
});
