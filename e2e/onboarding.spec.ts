// 1. First-time member: sign-up → /welcome → nickname + Roblox preview → profile greets by nickname.
import { createClient } from "@supabase/supabase-js";
import { clientAs, createUser, PASSWORD, profile } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

test("sign-up → welcome → nickname + Roblox preview → profile greets by nickname", async ({ page }) => {
  // Real sign-up is Google; the test sign-in stands in for it below.
  await page.goto("/join");
  await expect(page.getByRole("button", { name: "Sign up with your umich account" }).first()).toBeVisible();

  const user = await createUser({ onboarded: false, fullName: "Nina Newbie" });
  await signIn(page, user, "/profile");
  await expect(page).toHaveURL(/\/welcome\?next=%2Fprofile$/);
  await expect(page.getByText("Hi Nina!")).toBeVisible();

  await page.getByLabel(/Nickname/).fill("Nins");
  await page.getByLabel(/Roblox username/).fill("builderman");
  await page.getByRole("button", { name: "Let's go" }).click();

  // "Is this you?" preview from (mock) Roblox before anything is saved.
  await expect(page.getByText("Is this you?")).toBeVisible();
  await expect(page.getByText("@builderman")).toBeVisible();
  // Regression: on wide screens the narrow welcome card squeezed the name to
  // nothing, with "Yes, save" on top of it.
  const name = (await page.getByText("Builderman", { exact: true }).boundingBox())!;
  const yes = (await page.getByRole("button", { name: "Yes, save" }).boundingBox())!;
  expect(name.width).toBeGreaterThan(80);
  const overlap = name.x < yes.x + yes.width && name.x + name.width > yes.x && name.y < yes.y + yes.height && name.y + name.height > yes.y;
  expect(overlap, "name and Yes button overlap").toBe(false);
  expect((await profile(user.id)).onboarded_at).toBeNull();
  await page.getByRole("button", { name: "Yes, save" }).click();

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("Hey Nins!")).toBeVisible();
  const saved = await profile(user.id);
  expect(saved).toMatchObject({ nickname: "Nins", roblox_username: "builderman", roblox_user_id: 156 });
  expect(saved.onboarded_at).not.toBeNull();
});

test("welcome: an unknown Roblox username is caught before saving", async ({ page }) => {
  const user = await createUser({ onboarded: false, fullName: "Tia Typo" });
  await signIn(page, user, "/");
  await page.getByLabel(/Roblox username/).fill("nobody_here_123");
  await page.getByRole("button", { name: "Let's go" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Roblox/ })).toContainText("We couldn't find a Roblox user called “nobody_here_123”");
  expect((await profile(user.id)).onboarded_at).toBeNull();
});

test("welcome: skipping both fields still finishes sign-up", async ({ page }) => {
  const user = await createUser({ onboarded: false, fullName: "Sam Skip" });
  await signIn(page, user, "/events");
  await page.getByRole("button", { name: "Let's go" }).click();
  await expect(page).toHaveURL(/\/events$/);
  expect((await profile(user.id)).onboarded_at).not.toBeNull();
});

test("only umich.edu accounts can be created (before-user-created hook)", async () => {
  // A normal sign-up (the admin API skips auth hooks, so it can't test this).
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await anon.auth.signUp({ email: `e2e-${Date.now()}@gmail.com`, password: PASSWORD });
  expect(error?.message ?? "").toMatch(/umich\.edu/i);
  const ok = await anon.auth.signUp({ email: `e2e${Date.now()}@umich.edu`, password: PASSWORD });
  expect(ok.error).toBeNull();
});

test("profile: a refused nickname stays in the box to fix", async ({ page }) => {
  const user = await createUser({ fullName: "Ray Retry" });
  await signIn(page, user, "/profile");
  await page.getByLabel(/Nickname/).fill("<Ray>");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Nicknames are 1–30 characters/)).toBeVisible();
  await expect(page.getByLabel(/Nickname/)).toHaveValue("<Ray>");
});

test("profile: changing the Roblox username shows a readable preview", async ({ page }) => {
  const user = await createUser({ fullName: "Pia Preview" });
  await signIn(page, user, "/profile");
  await page.getByLabel(/Roblox username/).fill("e2e_player");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Is this you?")).toBeVisible();
  const name = (await page.getByText("E2E Player", { exact: true }).boundingBox())!;
  const yes = (await page.getByRole("button", { name: "Yes, save" }).boundingBox())!;
  expect(name.width).toBeGreaterThan(80);
  expect(name.x + name.width <= yes.x || name.y + name.height <= yes.y || yes.y + yes.height <= name.y).toBe(true);
  await page.getByRole("button", { name: "Yes, save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved!" })).toBeVisible();
  expect((await profile(user.id)).roblox_username).toBe("e2e_player");
});

test("regression: about 20 Roblox username lookups a minute per member", async ({ page, context }) => {
  const user = await createUser({ fullName: "Rita Ratelimit" });
  // Use up this minute's 20 lookups straight through the API.
  const c = await clientAs(user);
  for (let i = 0; i < 20; i++) expect((await c.rpc("take_roblox_lookup")).data).toBe(true);

  await signIn(page, user, "/profile");
  // The auth cookies on localhost (plain http) aren't Secure, or sign-in
  // would silently fail there; production builds mark them Secure.
  const auth = (await context.cookies()).filter((k) => k.name.startsWith("sb-"));
  expect(auth.length).toBeGreaterThan(0);
  for (const k of auth) expect([k.name, k.secure, k.sameSite]).toEqual([k.name, false, "Lax"]);

  // The "Is this you?" check is refused, and nothing reaches Roblox or the profile.
  await page.getByLabel(/Roblox username/).fill("e2e_player");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "checked a lot of Roblox usernames in the last minute" })).toBeVisible();
  await expect(page.getByText("Is this you?")).toHaveCount(0);
  expect((await profile(user.id)).roblox_username).toBeNull();

  // A minute's lookups are per member: someone else still gets theirs.
  const other = await createUser();
  expect((await (await clientAs(other)).rpc("take_roblox_lookup")).data).toBe(true);
});
