// 14. The About page (/about): story, milestones and founders with full-body
//     Roblox avatars; edited on /officer/content; linked from the footer,
//     /join and the home page.
import type { Browser, Page } from "@playwright/test";
import { admin, SEEDED } from "./support/db";
import { expect, expectAccessible, expectLayoutOk, signIn, test } from "./support/fixtures";

const SEED_STORY =
  "Roblox at UM started in October 2025, when a few students who loved playing and building on Roblox decided U-M needed a place to do it together. Our story is just getting started.";

/** Back to the seeded placeholders (story, one milestone, no founders). */
async function resetAbout() {
  await admin.from("about_people").delete().not("id", "is", null);
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

async function addPersonIn(officer: Page, i: number, name: string, role: string, roblox = "", blurb = "") {
  const section = officer.getByRole("region", { name: "About page" });
  await section.getByRole("button", { name: "Add person" }).click();
  await officer.locator(`#person-${i}-name`).fill(name);
  await officer.locator(`#person-${i}-role`).fill(role);
  if (roblox) await officer.locator(`#person-${i}-roblox`).fill(roblox);
  if (blurb) await officer.locator(`#person-${i}-blurb`).fill(blurb);
}

test("visitor: story, the founding milestone, founders coming soon; reached from home, /join and the footer", async ({ page, browser }) => {
  // Saved through the editor, which refreshes the cached page (the reset above
  // only changed the database). Everything else stays as seeded.
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
  await expect(page.getByRole("heading", { name: "Founders" })).toBeVisible();
  await expect(page.getByText("Founder profiles are coming soon.")).toBeVisible();

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

test("officer edits the About page: story, reordered milestones, founders with full-body avatars, hidden stays hidden", async ({ page, browser }) => {
  const { officer, section } = await officerContent(browser, page);

  await section.getByLabel("Story").fill("We started with  five people\nand a projector.");
  // A new milestone, moved above the founding one.
  await section.getByRole("button", { name: "Add milestone" }).click();
  await officer.locator("#milestone-1-date").fill("Sep 2025");
  await officer.locator("#milestone-1-title").fill("The first meetup");
  await officer.locator("#milestone-1-body").fill("Pizza and Piggy.");
  await section.getByRole("button", { name: "Move milestone 2 up" }).click();

  const addPerson = (i: number, name: string, role: string, roblox = "", blurb = "") => addPersonIn(officer, i, name, role, roblox, blurb);
  await addPerson(0, "Bea Builder", "Co-founder & President", "@BUILDERMAN", "Builds obbies for fun.");
  await addPerson(1, "Nico Noavatar", "Co-founder");
  await addPerson(2, "Hidden Hal", "Advisor");
  await section.getByRole("checkbox", { name: "Show on the site" }).nth(2).uncheck();
  // Nico first.
  await section.getByRole("button", { name: "Move person 2 up" }).click();

  await section.getByRole("button", { name: "Preview" }).click();
  await expect(section.getByText("Preview (not saved yet)")).toBeVisible();
  await section.getByRole("button", { name: "Save" }).click();
  await expect(section.getByText("Saved. It's live on the site now.")).toBeVisible();

  // Roblox's own capitalization and the user ID, looked up by the server.
  const { data: people } = await admin.from("about_people").select("name, roblox_username, roblox_user_id, visible").order("position");
  expect(people).toEqual([
    { name: "Nico Noavatar", roblox_username: null, roblox_user_id: null, visible: true },
    { name: "Bea Builder", roblox_username: "builderman", roblox_user_id: 156, visible: true },
    { name: "Hidden Hal", roblox_username: null, roblox_user_id: null, visible: false },
  ]);

  await page.goto("/about");
  await expect(page.getByText("We started with five people and a projector.")).toBeVisible();
  const milestones = page.locator("ol").filter({ hasText: "The first meetup" }).locator("li h3");
  await expect(milestones).toHaveText(["The first meetup", "Roblox at UM founded"]);
  const founders = page.locator("section#team li");
  await expect(founders.locator("h3")).toHaveText(["Nico Noavatar", "Bea Builder"]);
  await expect(founders.nth(0)).toContainText("NN"); // initials, no Roblox username
  await expect(founders.nth(1)).toContainText("Co-founder & President");
  await expect(founders.nth(1)).toContainText("Builds obbies for fun.");
  // The full-body avatar (not the headshot) for builderman (ID 156).
  await expect(founders.nth(1).getByTestId("founder-avatar")).toHaveAttribute("src", /tr\.rbxcdn\.com%2Fe2e%2Ffull%2F156\.webp/);
  await expect(page.getByText("Hidden Hal")).toHaveCount(0);
  expect(await page.content()).not.toContain("Hidden Hal");

  // Saving again without changing the username keeps the ID (no new lookup needed).
  await officer.reload();
  await expect(section.locator("#person-1-roblox")).toHaveValue("builderman");
  await officer.close();
});

test("refused: an unknown Roblox username, HTML and empty required fields; nothing saved", async ({ page, browser }) => {
  const { officer, section } = await officerContent(browser, page);
  await section.getByRole("button", { name: "Add person" }).click();
  await officer.locator("#person-0-name").fill("Ghost");
  await officer.locator("#person-0-role").fill("Founder");
  await officer.locator("#person-0-roblox").fill("nobody_here_x");
  await section.getByRole("button", { name: "Save" }).click();
  await expect(section.getByRole("alert").filter({ hasText: "Ghost: we couldn't find a Roblox user called “nobody_here_x”" })).toBeVisible();
  // Still there to fix.
  await expect(officer.locator("#person-0-roblox")).toHaveValue("nobody_here_x");

  await officer.locator("#person-0-roblox").fill("");
  await officer.locator("#person-0-role").fill("<b>Boss</b>");
  await section.getByRole("button", { name: "Save" }).click();
  await expect(section.getByRole("alert").filter({ hasText: /plain text only, no HTML/ })).toBeVisible();

  await officer.locator("#person-0-role").fill("Founder");
  await officer.locator("#milestone-0-title").fill("");
  await section.getByRole("button", { name: "Save" }).click();
  await expect(section.getByRole("alert").filter({ hasText: "Timeline item 1 title: write something." })).toBeVisible();

  expect((await admin.from("about_people").select("id")).data).toEqual([]);
  expect((await admin.from("about_timeline").select("title")).data).toEqual([{ title: "Roblox at UM founded" }]);
  await officer.close();
});

test("/about with founders: layout and accessibility", async ({ page, browser }) => {
  // Through the editor, so the cached page refreshes.
  const { officer, section } = await officerContent(browser, page);
  await addPersonIn(officer, 0, "Bea Builder", "Co-founder & President", "builderman", "Builds obbies for fun.");
  await addPersonIn(officer, 1, "Nico Noavatar", "Co-founder", "", "A rather long one-liner that has to wrap nicely on a narrow phone screen.");
  await addPersonIn(officer, 2, "Maximilian Extraordinarily-Longname", "Treasurer");
  await section.getByRole("button", { name: "Add milestone" }).click();
  await officer.locator("#milestone-1-date").fill("Winter 2026");
  await officer.locator("#milestone-1-title").fill("First 72-hour game jam with Roblox");
  await officer.locator("#milestone-1-body").fill("Teams built games start to finish.");
  await section.getByRole("button", { name: "Save" }).click();
  await expect(section.getByText("Saved. It's live on the site now.")).toBeVisible();
  await officer.close();

  await page.goto("/about");
  await expect(page.getByTestId("founder-avatar")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("about.png"), fullPage: true });
  await expectLayoutOk(page, "/about");
  await expectAccessible(page, "/about");
});

test("officer About editor: layout and accessibility, preview open", async ({ page }) => {
  await signIn(page, SEEDED.officer, "/officer/content");
  const section = page.getByRole("region", { name: "About page" });
  await section.getByRole("button", { name: "Add person" }).click();
  // Regression: a long unbroken name made the editor wider than a phone screen.
  await page.locator("#person-0-name").fill("Maximilian Extraordinarily-Longname");
  await page.locator("#person-0-role").fill("Co-founder");
  await section.getByRole("button", { name: "Preview" }).click();
  await expectLayoutOk(page, "/officer/content About");
  await expectAccessible(page, "/officer/content About");
});
