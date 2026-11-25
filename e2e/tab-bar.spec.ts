// 15. Nothing ends up under the phone tab bar. In the installed iPhone app the
//     bar sits above the home indicator (env(safe-area-inset-bottom)), so the
//     page needs that much more room at the bottom: the footer's last line
//     ("…not officially affiliated…") used to be covered by the Check In button.
//     Simulated here with a 34px bottom inset (an iPhone home indicator) and
//     with none (an ordinary phone browser); on desktop there is no extra gap.
import type { Page } from "@playwright/test";
import { checkInAs, createEvent, createUser, SEEDED, type TestEvent, type TestUser } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

const HOME_INDICATOR = 34;

let live: TestEvent;
let member: TestUser;

test.beforeAll(async () => {
  live = await createEvent({ title: "Tab Bar Check Night", open: true, capacity: 40 });
  member = await createUser({ fullName: "Tara Tabbar", nickname: "Tara" });
  expect(await checkInAs(member, live.code)).toBe("ok");
});

const PUBLIC = ["/", "/join", "/events", "EVENT", "/links", "/privacy", "/about", "/install", "/login", "/this-page-does-not-exist"];
const MEMBER = ["/", "/events", "/checkin", "/play", "/profile", "/links", "/join/done"];
const OFFICER = [
  "/officer",
  "/officer/events",
  "/officer/events/new",
  "/officer/events/EVENT",
  "/officer/members",
  "/officer/announcement",
  "/officer/content",
  "/officer/analytics",
  "/officer/flyer",
];
const path = (p: string) => (p === "EVENT" ? `/events/${live.id}` : p.replace("EVENT", live.id));

async function setHomeIndicator(page: Page, bottom: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { bottom } });
}

/**
 * Scrolled to the very bottom: where the page's last line of text ends (the
 * footer's, or the officer page's own when there is no footer) and where the
 * tab bar starts, counting the raised Check In button.
 */
async function bottomOfPage(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate(() => {
    const bar = [...document.querySelectorAll("nav")].find((n) => getComputedStyle(n).position === "fixed" && n.getBoundingClientRect().height > 0);
    if (!bar) return null;
    let barTop = bar.getBoundingClientRect().top;
    for (const el of bar.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && getComputedStyle(el).visibility !== "hidden") barTop = Math.min(barTop, r.top);
    }
    const scope = document.querySelector("footer") ?? document.querySelector("main")!;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (!n.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        const el = n.parentElement!;
        if (el.closest("[aria-hidden='true'], .sr-only") || el.getClientRects().length === 0) return NodeFilter.FILTER_REJECT;
        return getComputedStyle(el).position === "fixed" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    let last: Text | null = null;
    let lastBottom = -Infinity;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = range.getClientRects();
      const bottom = rects.length ? rects[rects.length - 1].bottom : -Infinity;
      if (bottom >= lastBottom) {
        lastBottom = bottom;
        last = n as Text;
      }
    }
    return {
      barTop,
      barInset: parseFloat(getComputedStyle(bar).paddingBottom),
      lastBottom,
      lastText: last?.textContent?.trim().slice(0, 60) ?? "",
    };
  });
}

async function expectClearOfTabBar(page: Page, url: string) {
  for (const inset of [HOME_INDICATOR, 0]) {
    await setHomeIndicator(page, inset);
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const m = await bottomOfPage(page);
    expect(m, `${url}: has a tab bar`).not.toBeNull();
    expect(m!.barInset, `${url}: the bar sits above the home indicator`).toBe(inset);
    expect(
      m!.lastBottom,
      `${url} (inset ${inset}px): last line “${m!.lastText}” ends at ${m!.lastBottom.toFixed(0)}, the tab bar starts at ${m!.barTop.toFixed(0)}`,
    ).toBeLessThanOrEqual(m!.barTop);
  }
}

test.describe("phone: the last line scrolls fully above the tab bar", () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "phone", "phone tab bar"));

  test("visitor pages", async ({ page }) => {
    for (const p of PUBLIC) await expectClearOfTabBar(page, path(p));
  });

  test("member pages", async ({ page }) => {
    await signIn(page, member, "/");
    for (const p of MEMBER) await expectClearOfTabBar(page, path(p));
  });

  test("officer pages", async ({ page }) => {
    await signIn(page, SEEDED.officer, "/officer");
    for (const p of OFFICER) await expectClearOfTabBar(page, path(p));
  });
});

test("desktop: no tab bar and no extra gap at the bottom", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop layout");
  await setHomeIndicator(page, HOME_INDICATOR);
  for (const url of ["/", "/about"]) {
    await page.goto(url);
    await expect(page.locator("nav.fixed:visible")).toHaveCount(0); // no phone tab bar
    expect(await page.locator("footer").evaluate((f) => getComputedStyle(f).paddingBottom), url).toBe("0px");
  }
  await signIn(page, SEEDED.officer, "/officer");
  expect(await page.locator("main").evaluate((m) => getComputedStyle(m).paddingBottom), "/officer").toBe("64px");
});
