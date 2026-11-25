// 12. The installable app: manifest and icons, iPhone home-screen tags and
//     splash screens, the service worker's offline page, /install per phone,
//     the members' "Get the app" bar, and sign-in + check-in from the
//     home-screen app (display-mode: standalone).
import type { Browser, BrowserContextOptions, Page } from "@playwright/test";
import { attendanceCount, createEvent, createUser } from "./support/db";
import { expect, expectAccessible, expectLayoutOk, signIn, test } from "./support/fixtures";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
// The home-screen app on iPhone: no "Version/... Safari/..." in the user agent.
const IPHONE_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36";
const INSTAGRAM = `${IPHONE_APP} Instagram 330.0.0.40.92 (iPhone15,2; iOS 18_5; en_US; en; scale=3.00; 1179x2556; 598234529)`;

const phone: BrowserContextOptions = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function phoneContext(browser: Browser, userAgent: string) {
  const context = await browser.newContext({ ...phone, userAgent });
  const page = await context.newPage();
  return { context, page };
}

/**
 * Like opening it from the home screen, from the next page load on:
 * (display-mode: standalone) matches and, as on iPhone, navigator.standalone.
 * (Chromium can't emulate display-mode itself, so the page's checks are answered.)
 */
async function asInstalledApp(page: Page) {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (!/display-mode:\s*standalone/.test(query)) return real(query);
      const m = real("all");
      return Object.defineProperties(m, { matches: { value: true }, media: { value: query } });
    };
    Object.defineProperty(Navigator.prototype, "standalone", { get: () => true, configurable: true });
  });
}

/** Width and height from a PNG's header. */
function pngSize(buf: Buffer) {
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("manifest: installable, standalone, with home-screen icons (incl. maskable) that exist at their sizes", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator("link[rel=manifest]").getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    id: "/",
    name: "Roblox at UM",
    short_name: "Roblox at UM",
    scope: "/",
    display: "standalone",
    background_color: "#061525",
    theme_color: "#061525",
  });
  expect(manifest.start_url).toMatch(/^\/(\?|$)/);
  const purposes = new Set<string>();
  for (const icon of manifest.icons as { src: string; sizes: string; purpose: string; type: string }[]) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    const { width, height } = pngSize(await res.body());
    expect(`${width}x${height}`, icon.src).toBe(icon.sizes);
    purposes.add(`${icon.purpose} ${icon.sizes}`);
  }
  // Chrome's install requirements: 192 and 512; Android's adaptive icon: maskable.
  expect([...purposes].sort()).toEqual(["any 192x192", "any 512x512", "maskable 192x192", "maskable 512x512"]);
  for (const s of manifest.shortcuts as { url: string }[]) expect((await request.get(s.url)).status(), s.url).toBe(200);
});

test("iPhone home screen: app icon, full-screen tags and a splash screen for each iPhone size", async ({ page, request }) => {
  await page.goto("/");
  const appleIcon = await page.locator("link[rel=apple-touch-icon]").getAttribute("href");
  const iconRes = await request.get(appleIcon!);
  expect(pngSize(await iconRes.body())).toEqual({ width: 180, height: 180 });
  await expect(page.locator("meta[name=mobile-web-app-capable]")).toHaveAttribute("content", "yes");
  await expect(page.locator("meta[name=apple-mobile-web-app-title]")).toHaveAttribute("content", "Roblox at UM");
  await expect(page.locator("meta[name=apple-mobile-web-app-status-bar-style]")).toHaveAttribute("content", "black-translucent");

  const splash = await page.locator("link[rel=apple-touch-startup-image]").evaluateAll((links) =>
    links.map((l) => ({ href: l.getAttribute("href")!, media: l.getAttribute("media")! })),
  );
  expect(splash.length).toBeGreaterThanOrEqual(12);
  for (const { href, media } of splash) {
    const m = /device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\)/.exec(media)!;
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
    expect(pngSize(await res.body()), href).toEqual({ width: +m[1] * +m[3], height: +m[2] * +m[3] });
  }
});

test("service worker: registers, is served fresh, and a page load with no connection shows the offline page", async ({ browser, request }) => {
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  expect(sw.headers()["content-type"]).toContain("javascript");

  // Its own context: going offline makes the page's background requests fail (expected here).
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the worker
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.goto("/events").catch(() => {});
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await context.close();
});

test("installed iPhone app: Google sign-in is offered (not the in-app browser screen) and returns to this app, keeping the check-in", async ({ browser }) => {
  const { context, page } = await phoneContext(browser, IPHONE_APP);
  await asInstalledApp(page);
  await page.goto("/login?next=%2Fcheckin%3Fcode%3DABCDE");
  expect(await page.evaluate(() => matchMedia("(display-mode: standalone)").matches)).toBe(true);
  await expect(page.getByRole("heading", { name: /Open this page in your browser/ })).toHaveCount(0);

  // Stop at the door to Google: just check where we'd go, and how we'd come back.
  let authorize = "";
  await context.route(/\/auth\/v1\/authorize/, (route) => {
    authorize = route.request().url();
    return route.fulfill({ status: 200, contentType: "text/html", body: "<title>Google</title>" });
  });
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await expect.poll(() => authorize).not.toBe("");
  const url = new URL(authorize);
  expect(url.searchParams.get("provider")).toBe("google");
  // Back to this site's callback (in the app's scope, so iOS returns to the app), check-in code kept.
  const back = new URL(url.searchParams.get("redirect_to")!);
  expect(back.origin + back.pathname).toBe("http://localhost:3200/auth/callback");
  expect(back.searchParams.get("next")).toBe("/checkin?code=ABCDE");
  // PKCE: the verifier waits in a cookie on this site, which the app shares with the callback.
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
  expect((await context.cookies()).some((c) => c.name.endsWith("-code-verifier") && c.domain === "localhost")).toBe(true);
  await context.close();
});

test("installed app: check in by typing the code, then Play, with no browser chrome needed", async ({ browser }) => {
  const event = await createEvent({ open: true });
  const member = await createUser({ nickname: "Appy" });
  const { context, page } = await phoneContext(browser, IPHONE_APP);
  await asInstalledApp(page);
  await signIn(page, member, "/");
  // The tab bar gets them there (no back button or address bar in the app).
  await page.getByRole("link", { name: "Check In" }).last().click();
  await page.getByLabel("Enter the 5-letter code").fill(event.code);
  await expect(page.getByRole("heading", { name: "You're checked in!" })).toBeVisible();
  expect(await attendanceCount(event.id)).toBe(1);
  await expect(page.getByRole("link", { name: /^Play/ }).last()).toBeVisible();
  // No "Get the app" bar inside the app.
  await expect(page.getByRole("region", { name: "Get the app" })).toHaveCount(0);
  await context.close();
});

test("/install: iPhone gets its steps first, marked as theirs", async ({ browser }) => {
  const { context, page } = await phoneContext(browser, IPHONE_SAFARI);
  await page.goto("/install");
  await expect(page.getByRole("heading", { name: "Add Roblox at UM to your Home Screen" })).toBeVisible();
  const iphone = page.getByRole("region", { name: /iPhone and iPad/ });
  await expect(iphone).toContainText("Your phone");
  await expect(page.getByRole("list", { name: "Steps for iPhone and iPad" })).toContainText("Add to Home Screen");
  await expect(page.getByRole("region", { name: /^Android/ })).not.toContainText("Your phone");
  await expect(page.getByRole("button", { name: "Install the app" })).toHaveCount(0);
  await context.close();
});

test("/install: Android gets its steps first, and an Install button when Chrome offers one", async ({ browser }) => {
  const { context, page } = await phoneContext(browser, ANDROID_CHROME);
  await page.goto("/install");
  const sections = page.locator("section[aria-labelledby^=steps-]");
  await expect(sections.first()).toContainText("Android");
  await expect(sections.first()).toContainText("Your phone");
  await expect(page.getByRole("button", { name: "Install the app" })).toHaveCount(0);

  // Chrome says it can install: our button shows Chrome's dialog.
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & Record<string, unknown>;
    e.prompt = async () => void ((window as unknown as Record<string, boolean>).prompted = true);
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
  await page.getByRole("button", { name: "Install the app" }).click();
  expect(await page.evaluate(() => (window as unknown as Record<string, boolean>).prompted)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByText("Open Roblox at UM from your home screen.")).toBeVisible();
  await context.close();
});

test("/install: in Instagram, open the page in the browser first; in the app, you're already there", async ({ browser }) => {
  const insta = await phoneContext(browser, INSTAGRAM);
  await insta.page.goto("/install");
  await expect(insta.page.getByText("Open this page in your browser first")).toBeVisible();
  await insta.context.close();

  const app = await phoneContext(browser, IPHONE_APP);
  await asInstalledApp(app.page);
  await app.page.goto("/install");
  await expect(app.page.getByText("You're using the app")).toBeVisible();
  await app.context.close();
});

test("'Get the app' bar: members on a phone browser, links to /install, closing keeps it closed", async ({ browser }) => {
  const member = await createUser();
  const { context, page: phonePage } = await phoneContext(browser, IPHONE_SAFARI);
  await signIn(phonePage, member, "/events");
  const bar = phonePage.getByRole("region", { name: "Get the app" });
  await expect(bar).toBeVisible();
  await bar.getByRole("link", { name: "How" }).click();
  await expect(phonePage).toHaveURL(/\/install$/);
  await expect(bar).toHaveCount(0); // not on /install itself
  await phonePage.goto("/events");
  await bar.getByRole("button", { name: "Close" }).click();
  await expect(bar).toHaveCount(0);
  await phonePage.reload();
  await expect(phonePage.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await expect(bar).toHaveCount(0);
  await context.close();

  // Signed-out visitors and computers: never.
  const visitor = await phoneContext(browser, IPHONE_SAFARI);
  await visitor.page.goto("/events");
  await expect(visitor.page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await expect(visitor.page.getByRole("region", { name: "Get the app" })).toHaveCount(0);
  await visitor.context.close();
  const computer = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const desk = await computer.newPage();
  await signIn(desk, member, "/events");
  await expect(desk.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await expect(desk.getByRole("region", { name: "Get the app" })).toHaveCount(0);
  await computer.close();
});

test("/install and the 'Get the app' bar: layout and accessibility", async ({ browser }) => {
  const member = await createUser();
  const { context, page } = await phoneContext(browser, ANDROID_CHROME);
  await signIn(page, member, "/");
  await expect(page.getByRole("region", { name: "Get the app" })).toBeVisible();
  await expectLayoutOk(page, "/ with the Get the app bar");
  await expectAccessible(page, "/ with the Get the app bar");
  await page.goto("/install");
  await page.screenshot({ path: test.info().outputPath("install.png"), fullPage: true });
  await expectLayoutOk(page, "/install");
  await expectAccessible(page, "/install");
  await context.close();
});
