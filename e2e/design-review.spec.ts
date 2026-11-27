// 17. Design review: event-page actions (RSVP first, check in yellow on event
//     day), signed-out header (Sign up), button wording, Events tabs, building
//     names on event pages.
import type { Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { pitch } from "../src/content/join";
import { admin, createEvent, createUser, SEEDED, updateEvent } from "./support/db";
import { expect, expectAccessible, expectLayoutOk, isPhone, signIn, test } from "./support/fixtures";

const isPrimary = async (l: Locator) => (await l.getAttribute("class"))?.includes("bg-maize") ?? false;

// A real (tiny) PNG, uploaded as the event's flyer.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAKCAIAAAD+SNA0AAAAEklEQVR4nGP4z8CAFTGMSgwqCQBBJ0zOlbqC0QAAAABJRU5ErkJggg==",
  "base64",
);

async function withFlyer(eventId: string) {
  const path = `${randomUUID()}.png`; // the bucket only takes "<uuid>.png|jpg"
  const { error } = await admin.storage.from("event-flyers").upload(path, PNG, { contentType: "image/png", upsert: true });
  if (error) throw error;
  await updateEvent(eventId, { flyer_path: path, flyer_width: 8, flyer_height: 10 });
}

const top = async (l: Locator) => (await l.boundingBox())!.y;

/** "YYYY-MM-DDTHH:mm" in Ann Arbor time, for datetime-local inputs. */
function clubInput(date: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

test("event page, days before: RSVP is the yellow action under the details and above the flyer; check in is outline", async ({ page }) => {
  const event = await createEvent({ startMin: 60 * 24 * 3, endMin: 60 * 24 * 3 + 120 });
  await withFlyer(event.id);
  // Next's image optimizer won't fetch from the local (private-address) Supabase: serve the flyer image directly.
  await page.route(/event-flyers/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));

  // Signed out: "RSVP with umich", yellow, in the same spot, with the first-time line under it.
  await page.goto(`/events/${event.id}`);
  const actions = page.getByTestId("primary-actions");
  const signInToRsvp = actions.getByRole("link", { name: "RSVP with umich" });
  await expect(signInToRsvp).toBeVisible();
  expect(await isPrimary(signInToRsvp)).toBe(true);
  await expect(signInToRsvp).toHaveAttribute("href", `/login?next=${encodeURIComponent(`/events/${event.id}`)}`);
  const firstTime = actions.getByText("First time? This creates your account.");
  await expect(firstTime).toBeVisible();
  expect(await top(firstTime)).toBeGreaterThan(await top(signInToRsvp));

  const member = await createUser();
  await signIn(page, member, `/events/${event.id}`);
  const rsvp = actions.getByRole("button", { name: "I’m going" });
  await expect(rsvp).toHaveAttribute("aria-pressed", "false");
  expect(await isPrimary(rsvp)).toBe(true);

  const checkIn = page.getByRole("link", { name: "Check in at the event" });
  await expect(checkIn).toHaveCount(1);
  expect(await isPrimary(checkIn)).toBe(false);
  await expect(actions.getByRole("link", { name: /check in/i })).toHaveCount(0);

  // Right under the details; on phones above the flyer, on desktop the flyer is in the right-hand column.
  const details = page.locator("article dl");
  const flyer = page.locator("#flyer-heading");
  await expect(flyer).toBeVisible();
  const detailsBottom = (await details.boundingBox())!.y + (await details.boundingBox())!.height;
  expect(await top(rsvp)).toBeGreaterThan(detailsBottom);
  expect(await top(rsvp) - detailsBottom).toBeLessThan(60);
  if (isPhone(page)) expect(await top(rsvp)).toBeLessThan(await top(flyer));
  expect(await top(rsvp)).toBeLessThan(await top(checkIn));

  // RSVP'd: "You're going", with a check, not yellow any more.
  await rsvp.click();
  const going = actions.getByRole("button", { name: "You’re going" });
  await expect(going).toHaveAttribute("aria-pressed", "true");
  await expect(going.locator("svg.lucide-circle-check")).toHaveCount(1);
  expect(await isPrimary(going)).toBe(false);
  await expect(actions).toContainText("Only officers can see RSVPs");
  await page.reload();
  await expect(actions.getByRole("button", { name: "You’re going" })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: test.info().outputPath("event-before.png"), fullPage: true });
  await expectLayoutOk(page, "event page before");
  await expectAccessible(page, "event page before");
});

test("event page, event day (from 2 hours before): check in is the yellow action up top; RSVP turns outline", async ({ page }) => {
  const soon = await createEvent({ startMin: 100, endMin: 220 }); // starts in 1h40
  const member = await createUser();
  await signIn(page, member, `/events/${soon.id}`);
  const actions = page.getByTestId("primary-actions");
  const checkIn = actions.getByRole("link", { name: "Check in at the event" });
  await expect(checkIn).toBeVisible();
  expect(await isPrimary(checkIn)).toBe(true);
  const rsvp = actions.getByRole("button", { name: "I’m going" });
  await expect(rsvp).toBeEnabled();
  expect(await isPrimary(rsvp)).toBe(false);
  await expect(page.locator("main").getByRole("link", { name: /check in/i })).toHaveCount(1); // not repeated further down
  await page.screenshot({ path: test.info().outputPath("event-day.png"), fullPage: true });

  // Live: "I'm here: check in", still yellow.
  const live = await createEvent({ startMin: -10, endMin: 60 });
  await page.goto(`/events/${live.id}`);
  expect(await isPrimary(actions.getByRole("link", { name: "I'm here: check in" }))).toBe(true);

  // Just outside the window (2h05 before): RSVP yellow, check in outline.
  const later = await createEvent({ startMin: 125, endMin: 240 });
  await page.goto(`/events/${later.id}`);
  await expect(actions.getByRole("button", { name: "I’m going" })).toBeEnabled();
  expect(await isPrimary(actions.getByRole("button", { name: "I’m going" }))).toBe(true);
  expect(await isPrimary(page.getByRole("link", { name: "Check in at the event" }))).toBe(false);

  // Over: neither.
  const over = await createEvent({ startMin: -200, endMin: -60 });
  await page.goto(`/events/${over.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(over.title);
  await expect(actions).toHaveCount(0);
  await expect(page.locator("main").getByRole("link", { name: /check in/i })).toHaveCount(0);
});

test("signed-out header: a yellow Sign up (to /join) and a plain Sign in; neither on /join or /login; Check In outline on desktop", async ({ page }) => {
  await page.goto("/events");
  const header = page.locator("header").first();
  const signUp = header.getByRole("link", { name: "Sign up", exact: true });
  await expect(signUp).toBeVisible();
  await expect(signUp).toHaveAttribute("href", "/join");
  expect(await isPrimary(signUp)).toBe(true);
  // Returning members: plain text, not a button, right before Sign up.
  const signIn_ = header.getByRole("link", { name: "Sign in", exact: true });
  await expect(signIn_).toBeVisible();
  await expect(signIn_).toHaveAttribute("href", "/login");
  expect(await isPrimary(signIn_)).toBe(false);
  expect(await signIn_.getAttribute("class")).not.toContain("border");
  const [inBox, upBox] = [(await signIn_.boundingBox())!, (await signUp.boundingBox())!];
  expect(inBox.x + inBox.width).toBeLessThanOrEqual(upBox.x);
  expect(upBox.x - (inBox.x + inBox.width)).toBeLessThan(24);
  if (!isPhone(page)) {
    const checkIn = header.getByRole("link", { name: "Check In" });
    await expect(checkIn).toBeVisible();
    expect(await isPrimary(checkIn)).toBe(false);
  } else {
    // Bottom nav unchanged.
    await expect(page.getByRole("navigation").getByRole("link", { name: "Check In", exact: true })).toBeVisible();
  }
  await page.screenshot({ path: test.info().outputPath("header-signed-out.png") });
  await expectLayoutOk(page, "header signed out");

  // Also on a dynamic route (the pathname streams in there).
  const event = await createEvent({ startMin: 60 * 24 * 6, endMin: 60 * 24 * 6 + 60 });
  await page.goto(`/events/${event.id}`);
  await expect(header.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: "Sign up", exact: true })).toBeVisible();

  // /join and /login have their own sign-up / sign-in buttons: none in the header, in the first HTML too.
  for (const path of ["/join", "/login"]) {
    const html = await (await page.request.get(path)).text();
    expect(html, path).not.toContain(">Sign up<"); // nor streamed in later
    expect(html.slice(html.indexOf("<header"), html.indexOf("</header>")), path).not.toContain(">Sign in<");
    await page.goto(path);
    await expect(header.getByRole("link", { name: "Sign up", exact: true }), path).toHaveCount(0);
    await expect(header.getByRole("link", { name: "Sign in", exact: true }), path).toHaveCount(0);
  }

  // Members: Check In stays yellow, no Sign up or Sign in.
  await signIn(page, await createUser(), "/events");
  await expect(header.getByRole("link", { name: "Sign up", exact: true })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  if (!isPhone(page)) await expect(header.getByRole("link", { name: "Check In" })).toHaveClass(/bg-maize/); // once the session streams in
});

test("button wording: 'Sign up with umich', 'Join the club', and the sign-in page's first-time line", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("button", { name: "Sign up with umich" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).last()).toHaveAttribute("href", "/login");

  await page.goto("/");
  const join = page.locator("main").getByRole("link", { name: "Join the club" });
  await expect(join).toHaveCount(2); // hero and banner
  for (const l of await join.all()) await expect(l).toHaveAttribute("href", "/join");
  await expect(page.locator("main").getByText("Join the Community")).toHaveCount(0);
  // Above the hero buttons, in the description's color.
  const line = page.getByText("Sign up with umich to RSVP and check in with one tap.");
  await expect(line).toBeVisible();
  expect(await top(line)).toBeLessThan(await top(join.first()));
  expect(await top(join.first()) - (await top(line))).toBeLessThan(100);
  const color = (l: Locator) => l.evaluate((el) => getComputedStyle(el).color);
  expect(await color(line)).toBe(await color(page.getByText(pitch, { exact: true }).first()));

  await page.goto("/about");
  await expect(page.locator("main").getByRole("link", { name: "Join the club" })).toHaveAttribute("href", "/join");

  await page.goto("/login");
  await expect(page.getByText("First time? Signing in creates your account.")).toBeVisible();
  await expect(page.locator("main").getByText("Members", { exact: true })).toHaveCount(0); // no label over the heading
});

test("locations: building codes spelled out on the event page with a Map link; cards keep the code", async ({ page }) => {
  await signIn(page, SEEDED.officer, "/officer/events/new");
  const title = `E2E Place ${randomUUID().slice(0, 6)}`;
  const start = new Date(Date.now() + 4 * 24 * 3600_000);
  start.setMinutes(0, 0, 0);
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Starts").fill(clubInput(start));
  await page.getByLabel("Ends").fill(clubInput(new Date(start.getTime() + 2 * 3600_000)));
  await page.getByLabel("Location").fill("CCCB 1420");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/officer\/events\/[0-9a-f-]{36}\?saved=1$/);
  const id = page.url().match(/events\/([0-9a-f-]{36})/)![1];

  await page.goto("/events");
  const card = page.locator("main li").filter({ hasText: title }).first();
  await expect(card).toContainText("CCCB 1420");
  await expect(card).not.toContainText("Central Campus");

  await page.goto(`/events/${id}`);
  const location = page.locator("article dl > div").filter({ hasText: "Location" });
  await expect(location).toContainText("Central Campus Classroom Building, Room 1420");
  const map = location.getByRole("link", { name: /^Map/ });
  await expect(map).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=Central%20Campus%20Classroom%20Building%2C%20Ann%20Arbor%2C%20MI");
  await expect(map).toHaveAttribute("target", "_blank");

  // NUB too; unknown places stay as typed, without a map.
  const nub = await createEvent({ startMin: 60 * 24 * 5, endMin: 60 * 24 * 5 + 60, location: "NUB 2001" });
  await page.goto(`/events/${nub.id}`);
  await expect(location).toContainText("North University Building, Room 2001");
  const union = await createEvent({ startMin: 60 * 24 * 5, endMin: 60 * 24 * 5 + 60, location: "Michigan Union Ballroom" });
  await page.goto(`/events/${union.id}`);
  await expect(location).toContainText("Michigan Union Ballroom");
  await expect(location.getByRole("link")).toHaveCount(0);
});

test("Events page: Past and All tabs only once there are past events; Subscribe is an outline button", async ({ page }) => {
  await page.goto("/events");
  const subscribe = page.getByRole("link", { name: /Subscribe to our calendar/ }).first();
  await expect(subscribe).toBeVisible();
  expect(await isPrimary(subscribe)).toBe(false);

  // The page's own list decides (it's cached): no past events, no tabs at all; otherwise all three.
  const past = page.getByRole("tab", { name: /Past/ });
  if (await page.getByRole("tablist").count()) {
    await expect(past).toBeVisible();
    await expect(page.getByRole("tab", { name: /All/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Upcoming/ })).toBeVisible();
  } else {
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("No past events yet");
  }
});
