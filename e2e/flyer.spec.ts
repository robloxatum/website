// 15. Flyer QR (/officer/flyer): a QR to the Join page (with a label), to one
//     upcoming event's page (optional label, same /…/src/<label> analytics
//     style) or to a short link; PNG and SVG downloads.
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { admin, createEvent, SEEDED } from "./support/db";
import { expect, expectAccessible, expectLayoutOk, signIn, test } from "./support/fixtures";

/** "YYYY-MM-DDTHH:mm" in Ann Arbor time, for datetime-local inputs. */
function clubInput(date: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * An upcoming event made through the officer form (which refreshes the cached
 * event lists), plus an event that already ended, made just before it.
 */
async function upcomingAndPast(officer: Page) {
  const past = await createEvent({ title: `E2E Past ${randomUUID().slice(0, 6)}`, startMin: -300, endMin: -240 });
  const title = `E2E Flyer Night ${randomUUID().slice(0, 6)}`;
  const start = new Date(Date.now() + 3 * 24 * 3600_000);
  start.setMinutes(0, 0, 0);
  await officer.goto("/officer/events/new");
  await officer.getByLabel("Title").fill(title);
  await officer.getByLabel("Starts").fill(clubInput(start));
  await officer.getByLabel("Ends").fill(clubInput(new Date(start.getTime() + 2 * 3600_000)));
  await officer.getByLabel("Location").fill("BBB 1670");
  await officer.getByRole("button", { name: "Create event" }).click();
  await expect(officer).toHaveURL(/\/officer\/events\/[0-9a-f-]{36}\?saved=1$/);
  const id = officer.url().match(/events\/([0-9a-f-]{36})/)![1];
  return { past, upcoming: { id, title } };
}

const qrLink = (page: Page) => page.locator("code").filter({ hasText: /^https?:\/\// });

async function downloaded(page: Page, name: string) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name }).click()]);
  return { filename: download.suggestedFilename(), bytes: await readFile(await download.path()) };
}

test("event page QR: upcoming events only, link with and without a label, PNG and SVG; Join and short links unchanged", async ({ page }) => {
  await signIn(page, SEEDED.officer, "/officer");
  const { past, upcoming } = await upcomingAndPast(page);
  try {
    await page.goto("/officer/flyer");
    const goesTo = page.getByLabel("QR goes to");

    // Default: the Join page, as before.
    await expect(goesTo).toHaveValue("join");
    await expect(page.getByText(/For flyers and posters about the club in general/)).toBeVisible();
    await expect(qrLink(page)).toHaveText(/\/join$/);
    await page.getByLabel(/^Label/).fill("Diag Board");
    await expect(qrLink(page)).toHaveText(/\/join\?src=diag-board$/);
    await expect(page.getByText("/join/src/diag-board")).toBeVisible();

    // An event page: only events that haven't ended.
    await goesTo.selectOption({ label: "An event page" });
    await expect(page.getByText(/For a flyer about one event/)).toBeVisible();
    const eventSelect = page.getByLabel("Event", { exact: true });
    const options = await eventSelect.locator("option").allInnerTexts();
    expect(options.some((o) => o.startsWith(`${upcoming.title} — `))).toBe(true);
    expect(options.some((o) => o.includes(past.title))).toBe(false);
    const { data: ended } = await admin.from("events").select("title").lt("ends_at", new Date().toISOString());
    for (const e of ended ?? []) expect(options.some((o) => o.startsWith(`${e.title} — `)), `${e.title} has ended`).toBe(false);
    // "Title — date"
    const option = options.find((o) => o.startsWith(`${upcoming.title} — `))!;
    expect(option).toMatch(/ — (Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{1,2}$/);

    await eventSelect.selectOption({ label: option });
    // The label typed for the Join page carries over…
    await expect(qrLink(page)).toHaveText(new RegExp(`/events/${upcoming.id}\\?src=diag-board$`));
    await expect(page.getByText(`/events/${upcoming.id}/src/diag-board`)).toBeVisible();
    // …and is optional.
    await page.getByLabel(/^Label/).fill("");
    await expect(qrLink(page)).toHaveText(new RegExp(`/events/${upcoming.id}$`));
    await page.getByLabel(/^Label/).fill("union-poster");
    const url = await qrLink(page).innerText();
    expect(url).toMatch(new RegExp(`^https?://[^/]+/events/${upcoming.id}\\?src=union-poster$`));
    await expect(page.getByTestId("flyer-qr")).toHaveAttribute("aria-label", `QR code for ${url}`);

    // Downloads: a 2400 px PNG and an SVG, named after the event and label.
    const slug = upcoming.title.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    const png = await downloaded(page, "PNG (2400 px)");
    expect(png.filename).toBe(`roblox-at-um-qr-event-${slug}-union-poster.png`);
    expect(png.bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect([png.bytes.readUInt32BE(16), png.bytes.readUInt32BE(20)]).toEqual([2400, 2400]);
    const svg = await downloaded(page, "SVG (for print)");
    expect(svg.filename).toBe(`roblox-at-um-qr-event-${slug}-union-poster.svg`);
    const svgText = svg.bytes.toString("utf8");
    expect(svgText).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+"/);
    expect(svgText).toMatch(/<path d="M\d+ \d+h1v1h-1z/);
    expect(svgText).toContain("<image href=\"data:image/png;base64,");

    // The link opens the event's public page (the label doesn't get in the way).
    await page.goto(new URL(url).pathname + new URL(url).search);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(upcoming.title);

    // Short links still work as before.
    await page.goto("/officer/flyer");
    await page.getByLabel("QR goes to").selectOption({ label: "Short link: /go/gameover" });
    await expect(page.getByText(/For a link that changes or expires/)).toBeVisible();
    await expect(qrLink(page)).toHaveText(/\/go\/gameover$/);
    await expect(page.getByLabel(/^Label/)).toHaveCount(0);
    expect((await downloaded(page, "SVG (for print)")).filename).toBe("roblox-at-um-qr-go-gameover.svg");
  } finally {
    await admin.from("events").delete().eq("id", past.id);
    page.once("dialog", (d) => d.accept());
    await page.goto(`/officer/events/${upcoming.id}`);
    await page.getByRole("button", { name: "Delete event" }).click();
    await expect(page).toHaveURL(/\/officer$/);
  }
});

test("/officer/flyer with an event picked: layout and accessibility", async ({ page }) => {
  await signIn(page, SEEDED.officer, "/officer");
  const { past, upcoming } = await upcomingAndPast(page);
  try {
    await page.goto("/officer/flyer");
    await page.getByLabel("QR goes to").selectOption({ label: "An event page" });
    await page.getByLabel("Event", { exact: true }).selectOption({ value: upcoming.id });
    await page.getByLabel(/^Label/).fill("a-rather-long-label-for-the-union-poster-board");
    await expect(page.getByTestId("flyer-qr")).toBeVisible();
    await expectLayoutOk(page, "/officer/flyer event");
    await expectAccessible(page, "/officer/flyer event");
  } finally {
    await admin.from("events").delete().eq("id", past.id);
    page.once("dialog", (d) => d.accept());
    await page.goto(`/officer/events/${upcoming.id}`);
    await page.getByRole("button", { name: "Delete event" }).click();
    await expect(page).toHaveURL(/\/officer$/);
  }
});
