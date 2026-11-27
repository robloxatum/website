import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test as base } from "@playwright/test";
import type { TestUser } from "./db";

// 1×1 PNG, served for Roblox avatar images (the tests never call Roblox) and optimized flyers.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

type Fixtures = { pageErrors: string[] };

export const test = base.extend<Fixtures>({
  // Every test: fake Roblox avatars, and fail on uncaught errors in the page.
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = m.text();
        // Expected: a deliberate 404/403 page load, and the (absent) Vercel analytics script.
        if (/status of (404|403|401)|_vercel\/insights/.test(text)) return;
        errors.push(`console: ${text}`);
      });
      await page.route(/rbxcdn\.com|_next\/image\?url=https%3A%2F%2Ftr\.rbxcdn\.com/, (route) =>
        route.fulfill({ status: 200, contentType: "image/png", body: PNG }),
      );
      // Flyers and covers through the image optimizer: Next refuses to optimize
      // images from local IPs (images.dangerouslyAllowLocalIP is off, as it
      // should be), and in E2E Storage is 127.0.0.1, so those requests can only
      // fail here. In production Storage is a public host. The stored files are
      // checked directly (image-metadata.spec.ts), not through the optimizer.
      await page.route(/_next\/image\?url=[^&]*event-flyers/, (route) =>
        route.fulfill({ status: 200, contentType: "image/png", body: PNG }),
      );
      await use(errors);
      expect(errors, "errors in the browser").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

/** Signs in a seeded/test user (test-only route), landing on `next`. */
export async function signIn(page: Page, user: TestUser | string, next = "/") {
  const email = typeof user === "string" ? `${user}@umich.edu` : user.email;
  await page.goto(`/auth/test-sign-in?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

/** Visible nav: header on desktop, bottom tab bar on phones. */
export function nav(page: Page) {
  return isPhone(page) ? page.getByRole("navigation", { name: /tab|bottom|phone|main/i }).last() : page.locator("header");
}

/** axe: fail on serious or critical issues (WCAG 2.1 A/AA + best practices). */
export async function expectAccessible(page: Page, label = page.url()) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  const bad = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.impact} ${v.id}: ${v.help}\n    ${v.nodes.slice(0, 4).map((n) => n.target.join(" ")).join("\n    ")}`);
  expect(bad, `axe on ${label}`).toEqual([]);
}

export const WIDTHS = [390, 768, 1024, 1280, 1440];

/**
 * At each width: nothing wider than the viewport (no sideways scrolling), and
 * no content stuck under a fixed bar (header / phone tab bar) at the top or
 * bottom of the page.
 */
export async function expectLayoutOk(page: Page, label = page.url()) {
  const original = page.viewportSize()!;
  const problems: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: original.height });
    await page.waitForTimeout(150);
    const found = await page.evaluate(findLayoutProblems);
    problems.push(...found.map((p) => `${width}px: ${p}`));
  }
  await page.setViewportSize(original);
  expect(problems, `layout on ${label}`).toEqual([]);
}

/** Runs in the page. */
async function findLayoutProblems(): Promise<string[]> {
  const out: string[] = [];
  const vw = document.documentElement.clientWidth;
  const describe = (el: Element) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `<${el.tagName.toLowerCase()}${id}${cls}>${text ? ` “${text}”` : ""}`;
  };
  const visible = (el: Element) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.visibility !== "hidden" && s.display !== "none" && r.width > 2 && r.height > 2;
  };
  // Clipped by a scrolling/hidden-overflow ancestor (carousels, tables): fine.
  const clipped = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) return true;
    }
    return false;
  };

  // 1. Sideways overflow.
  window.scrollTo(0, 0);
  if (document.documentElement.scrollWidth > vw + 1) {
    const culprits = [...document.body.querySelectorAll("*")]
      .filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1 && !clipped(el))
      .filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)));
    out.push(`page is ${document.documentElement.scrollWidth}px wide (viewport ${vw}px): ${culprits.slice(0, 3).map(describe).join(", ") || "?"}`);
  }

  // 2. Fixed bars covering content.
  const bars = [...document.body.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    if (s.position !== "fixed" || !visible(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width > vw * 0.6 && r.height < innerHeight * 0.3; // a bar, not an overlay or a toast
  });
  const content = () =>
    [...document.body.querySelectorAll("a, button, input, select, textarea, h1, h2, h3, p, li, label, td, th, img")].filter(
      (el) => visible(el) && !bars.some((b) => b.contains(el)) && getComputedStyle(el).position !== "fixed",
    );
  const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  for (const [where, y] of [["top", 0], ["bottom", document.documentElement.scrollHeight]] as const) {
    window.scrollTo(0, y);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    for (const bar of bars) {
      const br = bar.getBoundingClientRect();
      // Only bars at the edge we're checking.
      if (where === "top" ? br.top > 2 : br.bottom < innerHeight - 2) continue;
      // Covered = where they overlap, the bar is what's actually on top.
      const hit = content().find((el) => {
        const r = el.getBoundingClientRect();
        if (!overlaps(r, br)) return false;
        const x = (Math.max(r.left, br.left) + Math.min(r.right, br.right)) / 2;
        const y = (Math.max(r.top, br.top) + Math.min(r.bottom, br.bottom)) / 2;
        const top = document.elementFromPoint(x, y);
        return !!top && bar.contains(top) && !el.contains(top);
      });
      if (hit) out.push(`${describe(hit)} is under the fixed bar ${describe(bar)} at the ${where} of the page`);
    }
  }
  window.scrollTo(0, 0);
  return out;
}
