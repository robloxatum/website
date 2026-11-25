// 9. In-app browsers: /login and /join (and check-in, via /login) show "Open this
//    page in your browser" instead of Google sign-in, and never go near Google.
import type { Browser } from "@playwright/test";
import { createEvent } from "./support/db";
import { expect, expectAccessible, expectLayoutOk, test } from "./support/fixtures";

const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID_WV = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36";

// One screen for every app and phone, naming no browser. Only Android also gets
// an "Open in browser" button (an intent:// link to the default browser).
const AGENTS = [
  { name: "Instagram (iPhone)", ua: `${IOS} Instagram 330.0.0.40.92 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 598234529)`, button: false },
  { name: "GroupMe (iPhone)", ua: `${IOS} GroupMe/5.84.0`, button: false },
  { name: "Instagram (Android)", ua: `${ANDROID_WV} Instagram 330.0.0.40.92 Android (34/14; 420dpi; 1080x2400; Google; Pixel 8)`, button: true },
  { name: "Facebook (Android)", ua: `${ANDROID_WV} [FB_IAB/FB4A;FBAV/467.0.0.48.110;]`, button: true },
  { name: "Android WebView", ua: ANDROID_WV, button: true },
];

async function inApp(browser: Browser, ua: string) {
  const context = await browser.newContext({ userAgent: ua, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await context.newPage();
  const google: string[] = [];
  page.on("request", (r) => {
    if (/accounts\.google\.com|\/auth\/v1\/authorize/.test(r.url())) google.push(r.url());
  });
  return { context, page, google };
}

for (const agent of AGENTS) {
  test(`${agent.name}: the general "open in your browser" screen, never Google`, async ({ browser }) => {
    const { context, page, google } = await inApp(browser, agent.ua);
    for (const path of ["/login", "/join"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Open this page in your browser to sign in" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Sign (in|up) with/ })).toHaveCount(0);
      expect(await page.locator("a[href*='google'], form[action*='google']").count(), path).toBe(0);

      // The same step everywhere, with the arrow in the top-right corner (where
      // the app's menu is) but below our header, so it covers none of its links.
      await expect(page.getByRole("list", { name: "How to open this page in your browser" })).toContainText(
        "Tap the menu at the top right (••• or ⋮) → Open in browser",
      );
      const arrow = page.getByTestId("menu-arrow");
      await expect(arrow).toBeVisible();
      const box = (await arrow.boundingBox())!;
      expect(box.y).toBeLessThan(100);
      expect(box.x + box.width).toBeGreaterThan(page.viewportSize()!.width - 40);
      const header = (await page.locator("header").first().boundingBox())!;
      expect(box.y, "arrow is below the header").toBeGreaterThanOrEqual(header.y + header.height);

      // Android only: Open in browser, handing the page to the default browser.
      const open = page.getByRole("link", { name: "Open in browser" });
      if (agent.button) {
        await expect(open).toHaveAttribute("href", new RegExp(`^intent://localhost:3200${path}#Intent;scheme=http;`));
        expect(await open.getAttribute("href")).not.toMatch(/package=/);
      } else {
        await expect(open).toHaveCount(0);
      }
      // No browser named, and no browser-specific links, anywhere on the screen.
      const notice = page.getByRole("region", { name: "Open this page in your browser to sign in" });
      await expect(notice).not.toContainText(/Safari|Chrome/);
      expect(await page.locator("a[href^='x-safari'], a[href*='com.android.chrome']").count()).toBe(0);

      // Copy link: the backup everywhere, with a visible confirmation.
      await page.getByRole("button", { name: "Copy link" }).click();
      await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();
      await expect(page.getByText("Copied! Now paste it into your browser.")).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
    }
    expect(google).toEqual([]);
    await context.close();
  });
}

test("check-in from an in-app browser lands on the same screen, keeping the code", async ({ browser }) => {
  const event = await createEvent({ open: true });
  const { context, page, google } = await inApp(browser, AGENTS[0].ua);
  await page.goto(`/checkin?code=${event.code}`);
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole("heading", { name: "Open this page in your browser to sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Copy link" }).click();
  expect(decodeURIComponent(await page.evaluate(() => navigator.clipboard.readText()))).toContain(`/checkin?code=${event.code}`);
  expect(google).toEqual([]);
  await context.close();
});

test("a normal phone browser still gets Google sign-in", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByText(/to sign in$/)).toHaveCount(0);
});

for (const agent of [AGENTS[0], AGENTS[4]]) {
  test(`${agent.name} screen: layout and accessibility`, async ({ browser }) => {
    const { context, page } = await inApp(browser, agent.ua);
    await page.goto("/join");
    await expect(page.getByTestId("menu-arrow")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("in-app.png") });
    await expectLayoutOk(page, `/join in ${agent.name}`);
    await expectAccessible(page, `/join in ${agent.name}`);
    await context.close();
  });
}
