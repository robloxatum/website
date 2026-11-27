// 14. The About page (/about): story and milestones (edited on /officer/content)
//     and the founders (in code, src/content/founders.ts) with full-body Roblox
//     avatars looked up server-side; linked from the footer, /join and home.
import type { Browser, Page } from "@playwright/test";
import { admin, SEEDED } from "./support/db";
import { expect, expectAccessible, expectLayoutOk, signIn, test } from "./support/fixtures";

const SEED_STORY =
  "Roblox at UM started in October 2025, when a few students who loved playing and building on Roblox decided U-M needed a place to do it together. Our story is just getting started.";

const FOUNDERS = ["Alexander Villagomez", "Emily Garcia", "Evan Stocker", "Kaden Chirco"];
const USERNAMES = ["vaillex", "yayy_drpepper", "FinestBuilds", "noblemaxx"];

/** Back to the seeded placeholders (story, one milestone). */
async function resetAbout() {
  await admin.from("about_timeline").delete().not("id", "is", null);
  await admin.from("about_timeline").insert({ position: 0, date_label: "Oct 2025", title: "Roblox at UM founded", body: "" });
  await admin.from("about_story").update({ body: SEED_STORY }).eq("id", true);
}

test.beforeEach(resetAbout);
test.afterAll(resetAbout);

async function officerContent(browser: Browser, like: Page) {
  const officer = await browser.newPage({ viewport: like.viewportSize()! });
  await signIn(officer, SEEDED.officer, "/officer/content");
  const section = officer.getByRole("region", { name: "About page" });
  await expect(section).toBeVisible();
  return { officer, section };
}

const founderCards = (page: Page) => page.locator("section#team li");

test("founders: in order, name and role, full-body avatars (initials when Roblox doesn't know them), no usernames anywhere", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/about");
  const cards = founderCards(page);
  await expect(cards.locator("h3")).toHaveText(FOUNDERS);
  for (let i = 0; i < 4; i++) await expect(cards.nth(i)).toContainText("Cofounder");

  // Full-body avatars (the mock's ".../full/<id>.webp"), looked up from the usernames on the server.
  // The build ran without the Roblox mock, so the page may start with initials:
  // a failed lookup is only cached for about a minute, then it's retried.
  await expect
    .poll(
      async () => {
        await page.reload();
        return founderCards(page).first().getByTestId("founder-avatar").count();
      },
      { timeout: 120_000, intervals: [2_000, 5_000, 10_000] },
    )
    .toBe(1);
  // Straight from Roblox's CDN, not through /_next/image (audit 3, M-1).
  await expect(cards.nth(0).getByTestId("founder-avatar")).toHaveAttribute("src", "https://tr.rbxcdn.com/e2e/full/9001.webp");
  await expect(cards.nth(1).getByTestId("founder-avatar")).toHaveAttribute("src", "https://tr.rbxcdn.com/e2e/full/9002.webp");
  await expect(cards.nth(2).getByTestId("founder-avatar")).toHaveAttribute("src", "https://tr.rbxcdn.com/e2e/full/9003.webp");
  // Fallback: Roblox has no user "noblemaxx" (in the mock), so initials.
  await expect(cards.nth(3).getByTestId("founder-avatar")).toHaveCount(0);
  await expect(cards.nth(3)).toContainText("KC");
  // One-liners are empty, so none are shown.
  await expect(cards.locator("p.text-fg-2")).toHaveCount(0);

  // The Roblox usernames are only for the lookup: never in the page (HTML or RSC payload).
  const html = (await (await page.request.get("/about")).text()).toLowerCase();
  const rendered = (await page.content()).toLowerCase();
  for (const u of USERNAMES) {
    expect(html, `${u} in the HTML`).not.toContain(u.toLowerCase());
    expect(rendered, `${u} in the page`).not.toContain(u.toLowerCase());
  }
  await expect(page.getByText(/vaillex|yayy_drpepper|finestbuilds|noblemaxx/i)).toHaveCount(0);
});

test("visitor: story, the founding milestone and the founders; reached from home, /join and the footer", async ({ page, browser }) => {
  // Saved through the editor, which refreshes the cached page (the reset above
  // only changed the database).
  const story = `E2E story ${Date.now()}: a few students who loved Roblox.`;
  const { officer, section } = await officerContent(browser, page);
  await section.getByLabel("Story").fill(story);
  await section.getByRole("button", { name: "Save" }).click();
  await expect(section.getByText("Saved. It's live on the site now.")).toBeVisible();
  await officer.close();

  await page.goto("/");
  await page.getByRole("link", { name: "Meet the team" }).click();
  await expect(page).toHaveURL(/\/about#team$/);
  await expect(page.getByRole("heading", { name: "Founders" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: "Our story", level: 1 })).toBeVisible();
  await expect(page.getByText(story)).toBeVisible();
  await expect(page.getByRole("heading", { name: "How we got here" })).toBeVisible();
  await expect(page.getByText("Oct 2025", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Roblox at UM founded" })).toBeVisible();
  await expect(founderCards(page).locator("h3")).toHaveText(FOUNDERS);

  await expect(page.locator("footer").getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
  await page.goto("/join");
  await page.getByRole("link", { name: "Meet the founders" }).click();
  await expect(page).toHaveURL(/\/about#founders$/);
  await expect(page.getByRole("heading", { name: "Founders" })).toBeInViewport();
});

test("regression: 'Meet the founders' lands on the founders even when the page is slow to arrive", async ({ page }) => {
  // Hold back the /about data (prefetch and navigation), like a slow phone
  // connection: it used to arrive after the scroll, leaving people at the top.
  await page.route(/\/about(\?|$)/, async (route) => {
    if (route.request().headers()["rsc"]) await new Promise((r) => setTimeout(r, 2500));
    await route.continue().catch(() => {});
  });
  await page.goto("/join");
  await page.getByRole("link", { name: "Meet the founders" }).click();
  await expect(page).toHaveURL(/\/about#founders$/);
  await expect(page.getByRole("heading", { name: "Founders" })).toBeInViewport();
});

test("officer edits the story and reordered milestones; the founders aren't editable there", async ({ page, browser }) => {
  const { officer, section } = await officerContent(browser, page);
  await expect(section.getByText("src/content/founders.ts")).toBeVisible();
  await expect(section.getByRole("button", { name: "Add person" })).toHaveCount(0);
  await expect(section.getByRole("group", { name: "Founders" })).toHaveCount(0);
  await expect(section.getByLabel(/Roblox username/)).toHaveCount(0);

  await section.getByLabel("Story").fill("We started with  five people\nand a projector.");
  await section.getByRole("button", { name: "Add milestone" }).click();
  await officer.locator("#milestone-1-date").fill("Sep 2025");
  await officer.locator("#milestone-1-title").fill("The first meetup");
  await officer.locator("#milestone-1-body").fill("Pizza and Piggy.");
  await section.getByRole("button", { name: "Move milestone 2 up" }).click();
  await section.getByRole("button", { name: "Preview" }).click();
  await expect(section.getByText("Preview (not saved yet)")).toBeVisible();
  await section.getByRole("button", { name: "Save" }).click();
  await expect(section.getByText("Saved. It's live on the site now.")).toBeVisible();
  await officer.close();

  await page.goto("/about");
  await expect(page.getByText("We started with five people and a projector.")).toBeVisible();
  const milestones = page.locator("ol").filter({ hasText: "The first meetup" }).locator("li h3");
  await expect(milestones).toHaveText(["The first meetup", "Roblox at UM founded"]);
  await expect(founderCards(page).locator("h3")).toHaveText(FOUNDERS);
});

test("refused: HTML and empty required fields; nothing saved", async ({ page, browser }) => {
  const { officer, section } = await officerContent(browser, page);
  await officer.locator("#milestone-0-title").fill("<b>Boss</b>");
  await section.getByRole("button", { name: "Save" }).click();
  await expect(section.getByRole("alert").filter({ hasText: /plain text only, no HTML/ })).toBeVisible();

  await officer.locator("#milestone-0-title").fill("");
  await section.getByRole("button", { name: "Save" }).click();
  await expect(section.getByRole("alert").filter({ hasText: "Timeline item 1 title: write something." })).toBeVisible();

  expect((await admin.from("about_timeline").select("title")).data).toEqual([{ title: "Roblox at UM founded" }]);
  await officer.close();
});

test("/about: layout and accessibility", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByTestId("founder-avatar").first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("about.png"), fullPage: true });
  await expectLayoutOk(page, "/about");
  await expectAccessible(page, "/about");
});

test("officer About editor: layout and accessibility, preview open", async ({ page }) => {
  await signIn(page, SEEDED.officer, "/officer/content");
  const section = page.getByRole("region", { name: "About page" });
  await section.getByRole("button", { name: "Add milestone" }).click();
  await page.locator("#milestone-1-date").fill("Winter 2026");
  await page.locator("#milestone-1-title").fill("First 72-hour game jam with an unusually long milestone title");
  await section.getByRole("button", { name: "Preview" }).click();
  await expectLayoutOk(page, "/officer/content About");
  await expectAccessible(page, "/officer/content About");
});
