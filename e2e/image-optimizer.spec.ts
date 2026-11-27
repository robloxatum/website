import { expect, test } from "@playwright/test";

// Security audit 3, M-1: /_next/image refuses Roblox CDN URLs (avatars load
// straight from Roblox instead). Flyers from our Storage bucket are still an
// allowed pattern (tests/image-optimizer.test.mjs); that can't be shown here,
// because Next never optimizes images from local IPs like E2E's Storage.

test.describe("image optimizer", () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "HTTP only: once is enough"));

  test("refuses *.rbxcdn.com images, signed out", async ({ request }) => {
    for (const url of [
      "https://tr.rbxcdn.com/e2e/156.webp",
      "https://t0.rbxcdn.com/anything.png",
      "https://rbxcdn.com/x.png",
    ]) {
      const res = await request.get(`/_next/image?url=${encodeURIComponent(url)}&w=64&q=75`);
      expect(res.status(), url).toBe(400);
    }
  });
});
