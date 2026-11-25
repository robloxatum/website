// 8. Analytics page and the backup zip: officers only.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SEEDED } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

test("officers see analytics; members get 'Officers only'; visitors go to sign-in", async ({ page }) => {
  await signIn(page, SEEDED.officer, "/officer/analytics");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Analytics/i);
  await expect(page.getByText("Officers only")).toHaveCount(0);

  await signIn(page, SEEDED.member, "/officer/analytics");
  await expect(page.getByRole("heading", { name: "Officers only" })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/officer/analytics");
  await expect(page).toHaveURL(/\/login\?next=%2Fofficer%2Fanalytics/);
});

test("officer downloads the full backup zip; it opens and has every file", async ({ page }) => {
  await signIn(page, SEEDED.officer, "/officer");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download full backup" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^roblox-at-um-backup-\d{4}-\d{2}-\d{2}\.zip$/);
  const dir = mkdtempSync(join(tmpdir(), "e2e-backup-"));
  const zip = join(dir, "backup.zip");
  await download.saveAs(zip);
  const listing = execFileSync("unzip", ["-l", zip], { encoding: "utf8" });
  for (const f of ["members.csv", "events.csv", "attendance.csv", "rsvps.csv", "README.txt"]) expect(listing).toContain(f);
  const members = execFileSync("unzip", ["-p", zip, "members.csv"], { encoding: "utf8" });
  expect(members).toContain(`${SEEDED.member}@umich.edu`);
  writeFileSync(join(dir, "ok"), "");
});

test("members and visitors can't download the backup", async ({ page }) => {
  const anon = await page.request.get("/officer/backup.zip");
  expect(anon.status()).toBe(403);
  await signIn(page, SEEDED.member, "/");
  const member = await page.request.get("/officer/backup.zip");
  expect(member.status()).toBe(403);
  expect(member.headers()["content-type"]).not.toContain("zip");
});
