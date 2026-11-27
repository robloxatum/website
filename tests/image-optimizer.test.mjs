// Security audit 3, M-1: our image optimizer (/_next/image) must not fetch
// Roblox CDN images. Before the fix, `**.rbxcdn.com` was an allowed remote
// pattern, so anyone, signed out, could make the optimizer fetch and transform
// any *.rbxcdn.com image, using up the free plan's image allowance. Avatars now
// load straight from Roblox's CDN (`unoptimized`). Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const config = read("next.config.ts");

describe("image optimizer remote patterns", () => {
  it("allow no Roblox host (only the flyer bucket)", () => {
    const images = config.match(/^\s*images:.*$/m)?.[0];
    assert.ok(images, "next.config.ts has an images: line");
    assert.match(images, /remotePatterns: flyerImages\b/);
    for (const line of config.split("\n")) {
      if (/rbxcdn/i.test(line)) assert.match(line, /img-src|M-1|\*\.rbxcdn\.com images/, `rbxcdn outside the CSP: ${line.trim()}`);
      assert.doesNotMatch(line, /hostname:\s*["'][^"']*rbxcdn/i, `a remote pattern for Roblox: ${line.trim()}`);
    }
  });

  it("the CSP still lets the browser load avatars from Roblox's CDN", () => {
    assert.match(config, /img-src [^`]*https:\/\/\*\.rbxcdn\.com/);
  });
});

describe("Roblox avatar components", () => {
  for (const file of ["src/components/ui/Avatar.tsx", "src/components/content/FounderAvatar.tsx"]) {
    it(`${file} loads the image unoptimized`, () => {
      const src = read(file);
      const image = src.match(/<Image\b[\s\S]*?\/>/)?.[0];
      assert.ok(image, "renders next/image");
      assert.match(image, /^\s*unoptimized\s*$/m, "<Image unoptimized>");
    });
  }

});
