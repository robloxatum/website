// 9. In-app browsers: /login and /join (and check-in, via /login) show "Open in
//    Safari/Chrome" instead of Google sign-in, and never go near Google.
import type { Browser } from "@playwright/test";
import { createEvent } from "./support/db";
import { expect, test } from "./support/fixtures";

const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID_WV = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36";

const AGENTS = [
  { name: "Instagram (iPhone)", ua: `${IOS} Instagram 330.0.0.40.92 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 598234529)`, real: "Safari" },
  { name: "GroupMe (iPhone)", ua: `${IOS} GroupMe/5.84.0`, real: "Safari" },
  { name: "Facebook (Android)", ua: `${ANDROID_WV} [FB_IAB/FB4A;FBAV/467.0.0.48.110;]`, real: "Chrome" },
  { name: "Android WebView", ua: ANDROID_WV, real: "Chrome" },
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
  test(`${agent.name}: sign-in pages say "Open in ${agent.real}" and never link to Google`, async ({ browser }) => {
    const { context, page, google } = await inApp(browser, agent.ua);
    for (const path of ["/login", "/join"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: `Open in ${agent.real} to sign in` })).toBeVisible();
      await expect(page.getByRole("button", { name: /Sign (in|up) with/ })).toHaveCount(0);
      expect(await page.locator("a[href*='google'], form[action*='google']").count(), path).toBe(0);

      // Android: a button that hands the page to Chrome. (iPhone: only for https sites.)
      const open = page.getByRole("link", { name: `Open in ${agent.real}` });
      if (agent.real === "Chrome") {
        await expect(open).toHaveAttribute("href", new RegExp(`^intent://localhost:3200${path}#Intent;scheme=http;package=com\\.android\\.chrome;`));
      }

      await page.getByRole("button", { name: "Copy link" }).click();
      await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Open in Safari to sign in" })).toBeVisible();
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
