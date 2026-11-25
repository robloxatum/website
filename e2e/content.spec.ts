// 6. Announcements and the officer content editor (links / FAQ / featured), with
//    their validation: http links, HTML and //evil.com are refused.
import type { Locator, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { admin, SEEDED } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

test.afterEach(async () => {
  // Leave the site content as we found it.
  await admin.from("community_links").delete().like("label", "E2E%");
  await admin.from("join_faq").delete().like("question", "E2E%");
  await admin.from("announcements").delete().not("id", "is", null);
});

// --- Announcements ---------------------------------------------------------

async function announce(page: Page, message: string, link = "") {
  await page.getByLabel(/Message/).fill(message);
  await page.getByLabel(/Link/).fill(link);
  await page.getByRole("button", { name: "Publish" }).click();
}

test("officer publishes and clears the site announcement", async ({ page, browser }) => {
  const text = `E2E party tonight ${randomUUID().slice(0, 4)}`;
  await signIn(page, SEEDED.officer, "/officer/announcement");
  await announce(page, text, "/events");
  await expect(page.getByText("Published. It's showing on the site now.")).toBeVisible();

  const visitor = await browser.newPage({ viewport: page.viewportSize()! });
  await visitor.goto("/");
  const banner = visitor.getByText(text);
  await expect(banner).toBeVisible();
  await expect(visitor.getByRole("link", { name: /Learn more/ })).toHaveAttribute("href", "/events");

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByText("Cleared. The banner is gone.")).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByText(text)).toHaveCount(0);
  await visitor.close();
});

test("announcement validation: bad links and HTML are refused", async ({ page }) => {
  await signIn(page, SEEDED.officer, "/officer/announcement");
  await page.waitForLoadState("networkidle");
  const refused = async (message: string, link: string, error: RegExp) => {
    await announce(page, message, link);
    await expect(page.getByRole("alert").filter({ hasText: error })).toBeVisible();
    const { data } = await admin.from("announcements").select("id");
    expect(data ?? [], `${message} / ${link}`).toEqual([]);
  };
  const notAllowed = /Links can go to our own site, roblox\.com or umich\.edu/;
  await refused("E2E hi", "//evil.com", notAllowed);
  // Regression: the refused link is still there to fix (it used to be wiped).
  await expect(page.getByLabel(/Link/)).toHaveValue("//evil.com");
  await refused("E2E hi", "https://evil.com/x", notAllowed);
  await refused("E2E hi", "http://evil.com", notAllowed);
  await refused("E2E hi", "javascript:alert(1)", notAllowed);
  await refused("E2E hi", "https://www.roblox.com.evil.com/", notAllowed);
  await refused("E2E <b>bold</b> news", "", /plain text only, no HTML/);
  await refused("E2E <script>alert(1)</script>", "", /plain text only, no HTML/);
});

// --- Content editor ----------------------------------------------------------

const section = (page: Page, name: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });

async function save(sec: Locator) {
  await sec.getByRole("button", { name: "Save" }).click();
}

test("officer adds a link and an FAQ question; they're live on /links and /join", async ({ page, browser }) => {
  const label = `E2E Link ${randomUUID().slice(0, 4)}`;
  const question = `E2E Do I need a laptop ${randomUUID().slice(0, 4)}?`;
  await signIn(page, SEEDED.officer, "/officer/content");

  const links = section(page, "Links");
  await links.getByRole("button", { name: "Add link" }).click();
  await links.getByLabel("Label").last().fill(label);
  await links.getByLabel("URL").last().fill("https://example.com/e2e");
  await links.getByLabel(/Short description/).last().fill("Our test link");
  await save(links);
  await expect(links.getByText("Saved. It's live on the site now.")).toBeVisible();

  const join = section(page, "Join page: FAQ and “What we do”");
  await join.getByRole("button", { name: "Add question" }).click();
  await join.getByLabel("Question").last().fill(question);
  await join.getByLabel("Answer").last().fill("Nope, phones work too.");
  await save(join);
  await expect(join.getByText("Saved. It's live on the site now.")).toBeVisible();

  // As a visitor (signed-in members get "You're in" on /join, not the FAQ; this
  // test used to check as the officer and only passed when it caught the page
  // before that swap). The very first HTML after the save must already have both.
  const visitor = await browser.newContext({ viewport: page.viewportSize()! });
  for (const [path, text] of [["/join", question], ["/links", label]]) {
    const html = await (await visitor.request.get(path)).text();
    expect(html, `${path} first HTML after the save`).toContain(text);
  }
  const v = await visitor.newPage();
  await v.goto("/links");
  await expect(v.getByRole("link", { name: new RegExp(label) }).first()).toHaveAttribute("href", "https://example.com/e2e");
  await v.goto("/join");
  // Visible only: while /join streams, React briefly holds a hidden second copy.
  await expect(v.getByText(question).filter({ visible: true })).toBeVisible();
  await visitor.close();
});

test("content validation: http, HTML and //evil.com are refused", async ({ page }) => {
  await signIn(page, SEEDED.officer, "/officer/content");
  const links = section(page, "Links");
  await links.getByRole("button", { name: "Add link" }).click();
  const label = links.getByLabel("Label").last();
  const url = links.getByLabel("URL").last();
  const tryLink = async (l: string, u: string, error: RegExp) => {
    await label.fill(l);
    await url.fill(u);
    await save(links);
    await expect(links.getByRole("alert").filter({ hasText: error })).toBeVisible();
  };
  await tryLink("E2E Plain", "http://example.com", /https:\/\/ link/);
  await tryLink("E2E Plain", "//evil.com", /https:\/\/ link|doesn.t look like a link/);
  await tryLink("E2E Plain", "javascript:alert(1)", /https:\/\/ link|doesn.t look like a link/);
  await tryLink("E2E <b>bold</b>", "https://example.com", /plain text only, no HTML/);
  const { data } = await admin.from("community_links").select("label").like("label", "E2E%");
  expect(data ?? []).toEqual([]);

  const join = section(page, "Join page: FAQ and “What we do”");
  await join.getByRole("button", { name: "Add question" }).click();
  await join.getByLabel("Question").last().fill("E2E <img src=x onerror=alert(1)>");
  await join.getByLabel("Answer").last().fill("x");
  await save(join);
  await expect(join.getByRole("alert").filter({ hasText: /plain text only, no HTML/ })).toBeVisible();

  const featured = section(page, "Featured panel");
  await featured.getByLabel("Link text").fill("Go");
  const href = featured.getByLabel("Link", { exact: true });
  for (const bad of ["//evil.com", "http://example.com", "javascript:alert(1)", "/\\evil.com"]) {
    await href.fill(bad);
    await save(featured);
    await expect(featured.getByRole("alert").filter({ hasText: /path on our site|https:\/\/ link/ }), bad).toBeVisible();
  }
});

test("members can't open the officer editors", async ({ page }) => {
  for (const path of ["/officer/content", "/officer/announcement"]) {
    await signIn(page, SEEDED.member, path);
    await expect(page.getByRole("heading", { name: "Officers only" })).toBeVisible();
  }
});
