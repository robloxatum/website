// Sign-in return URLs (?next=...) must stay on this site. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeNext } from "../src/lib/safe-next.ts";
import { isSitePath } from "../src/lib/shortlinks.ts";

const SITE = "https://robloxatum.vercel.app/auth/callback";
const lands = (next) => new URL(safeNext(next), SITE).host;

const attacks = [
  "https://evil.example",
  "//evil.example",
  "/\\evil.example",
  "/\t/evil.example",
  "/..//evil.example",
  "/.//evil.example",
  "/a/..//evil.example/x",
  "/%2e%2e//evil.example",
  "/%2E%2E/%2F%2Fevil.example",
  "javascript:alert(1)",
];

describe("safeNext", () => {
  for (const next of attacks) {
    it(`keeps ${JSON.stringify(next)} on this site`, () => assert.equal(lands(next), "robloxatum.vercel.app"));
  }
  it("keeps normal paths, queries and hashes", () => {
    assert.equal(safeNext("/events/abc?x=1#top"), "/events/abc?x=1#top");
    assert.equal(safeNext("/welcome?next=%2Fevents"), "/welcome?next=%2Fevents");
  });
  it("falls back for empty values", () => assert.equal(safeNext(null), "/"));
});

describe("isSitePath (short links)", () => {
  for (const path of attacks) {
    it(`rejects ${JSON.stringify(path)}`, () => assert.equal(isSitePath(path) && new URL(path, SITE).host !== "robloxatum.vercel.app", false));
  }
  it("rejects dot segments that resolve to another host", () => assert.equal(isSitePath("/..//evil.example"), false));
  it("accepts site paths", () => assert.equal(isSitePath("/join?src=flyer"), true));
});
