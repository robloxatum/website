// 7. Roles: owners make / remove officers; officers can't; nobody can demote the last owner.
import { admin, clientAs, createUser, profile, SEEDED, userByUniqname } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

const memberRow = (page: import("@playwright/test").Page, uniqname: string) =>
  // A table row on wide screens, a card (list item) on phones.
  page.locator("tr:visible, li:visible").filter({ hasText: uniqname });

test("the owner makes a member an officer, then removes them", async ({ page }) => {
  const m = await createUser({ fullName: "Rosa Rolechange" });
  await signIn(page, SEEDED.owner, "/officer/members");
  await page.getByLabel("Search").fill(m.uniqname);
  const row = memberRow(page, m.uniqname);
  page.on("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Make officer" }).click();
  await expect(row.getByRole("button", { name: "Remove officer" })).toBeVisible();
  expect((await profile(m.id)).is_officer).toBe(true);

  // Their next page load is the officer portal.
  await row.getByRole("button", { name: "Remove officer" }).click();
  await expect(row.getByRole("button", { name: "Make officer" })).toBeVisible();
  expect((await profile(m.id)).is_officer).toBe(false);
});

test("officers can't change roles (no buttons, and the database refuses)", async ({ page }) => {
  const m = await createUser();
  await signIn(page, SEEDED.officer, "/officer/members");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Make officer|Remove officer/ })).toHaveCount(0);

  const officer = await clientAs(await userByUniqname(SEEDED.officer));
  const { error } = await officer.rpc("set_officer", { p_user_id: m.id, p_is_officer: true });
  expect(error).not.toBeNull();
  // Nor by writing the column directly.
  await officer.from("profiles").update({ is_officer: true, is_owner: true }).eq("id", m.id);
  expect(await profile(m.id)).toMatchObject({ is_officer: false, is_owner: false });
});

test("nobody can demote the last owner, not even the owner", async ({ page }) => {
  const ownerUser = await userByUniqname(SEEDED.owner);
  await signIn(page, SEEDED.owner, "/officer/members");
  await page.getByLabel("Search").fill(SEEDED.owner);
  await expect(memberRow(page, SEEDED.owner).getByText("Owner", { exact: true })).toBeVisible();
  await expect(memberRow(page, SEEDED.owner).getByRole("button", { name: /officer/ })).toHaveCount(0);

  const owner = await clientAs(ownerUser);
  const viaRpc = await owner.rpc("set_officer", { p_user_id: ownerUser.id, p_is_officer: false });
  expect(viaRpc.error).not.toBeNull();
  await owner.from("profiles").update({ is_owner: false, is_officer: false }).eq("id", ownerUser.id);
  // Even with full database rights (the trigger guards it).
  const viaAdmin = await admin.from("profiles").update({ is_owner: false }).eq("id", ownerUser.id);
  expect(viaAdmin.error?.message ?? "").toMatch(/owner/i);
  expect(await profile(ownerUser.id)).toMatchObject({ is_owner: true, is_officer: true });
});
