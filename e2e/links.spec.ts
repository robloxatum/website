// 16. The Links page (/links): the Email row copies the officers' address
//     (copy icon, address shown, "Copied" confirmation), unlike the rows that
//     open other sites (↗, new tab).
import { expect, expectAccessible, expectLayoutOk, test } from "./support/fixtures";

const EMAIL = "robloxatumich@gmail.com";

test("Email row: shows the address, copies it on tap, confirms with a checkmark and 'Copied'", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/links");
  const row = page.getByRole("button", { name: `Copy Email address ${EMAIL}` });
  await expect(row).toBeVisible();
  await expect(row).toContainText(EMAIL); // the subtitle, readable without tapping
  // A copy icon, not the ↗ used by rows that open other sites; and not a link.
  await expect(row.locator("svg.lucide-copy")).toHaveCount(1);
  await expect(row.locator("svg.lucide-arrow-up-right")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Email/ })).toHaveCount(0);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);

  await row.click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);
  await expect(row.getByRole("status")).toHaveText("Copied");
  await expect(row.locator("svg.lucide-check")).toHaveCount(1);
  await expect(row.locator("svg.lucide-copy")).toHaveCount(0);
  // Back to the copy icon after a couple of seconds.
  await expect(row.locator("svg.lucide-copy")).toHaveCount(1, { timeout: 5000 });
  await expect(row.getByRole("status")).toHaveText("");
});

test("Email row: still copies where the Clipboard API isn't available", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("blocked")) } });
    (window as unknown as { __copied: string[] }).__copied = [];
    const original = document.execCommand.bind(document);
    document.execCommand = (cmd: string, ...rest: unknown[]) => {
      if (cmd === "copy") {
        (window as unknown as { __copied: string[] }).__copied.push(String(window.getSelection() ?? (document.activeElement as HTMLTextAreaElement | null)?.value));
        return true;
      }
      return original(cmd, ...(rest as [boolean, string]));
    };
  });
  await page.goto("/links");
  const row = page.getByRole("button", { name: `Copy Email address ${EMAIL}` });
  await row.click();
  await expect(row.getByRole("status")).toHaveText("Copied");
  expect(await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied)).toEqual([EMAIL]);
});

test("the other rows still open other sites in a new tab, with the ↗ arrow", async ({ page }) => {
  await page.goto("/links");
  const external = page.locator("main ul").first().getByRole("link");
  const n = await external.count();
  for (let i = 0; i < n; i++) {
    await expect(external.nth(i)).toHaveAttribute("target", "_blank");
    await expect(external.nth(i).locator("svg.lucide-arrow-up-right")).toHaveCount(1);
  }
});

test("/links after copying: layout and accessibility", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/links");
  await page.getByRole("button", { name: `Copy Email address ${EMAIL}` }).click();
  await expect(page.getByText("Copied", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("links-copied.png"), fullPage: true });
  await expectLayoutOk(page, "/links copied");
  await expectAccessible(page, "/links copied");
});
