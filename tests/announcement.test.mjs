// Announcement banner: message and link rules. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dismissKey, normalizeLink, normalizeMessage } from "../src/lib/announcement.ts";

const SITE = ["robloxatum.vercel.app", "localhost"];
// Same rule as the database (announcements_link_check).
const DB_RULE = (l) =>
  /^\/([^/\\\s"'<>][^\s"'<>\\]*)?$/.test(l) || /^https:\/\/([a-z0-9-]+\.)*(roblox\.com|umich\.edu)(\/[^\s"'<>\\]*)?$/.test(l);

describe("normalizeMessage", () => {
  it("trims and collapses whitespace, up to 140 characters", () => {
    assert.deepEqual(normalizeMessage("  Game night   moved\n to BBB 1670 "), { message: "Game night moved to BBB 1670" });
    assert.deepEqual(normalizeMessage("x".repeat(140)), { message: "x".repeat(140) });
    assert.ok("error" in normalizeMessage("x".repeat(141)));
    assert.ok("error" in normalizeMessage("   "));
  });
});

describe("normalizeLink", () => {
  it("accepts our own site (stored as a path), roblox.com and umich.edu", () => {
    for (const [input, out] of [
      ["", null],
      ["/events", "/events"],
      ["/", "/"],
      ["https://robloxatum.vercel.app/play", "/play"],
      ["https://robloxatum.vercel.app", "/"],
      ["robloxatum.vercel.app/events?tab=past", "/events?tab=past"],
      ["https://www.roblox.com/games/1/Obby", "https://www.roblox.com/games/1/Obby"],
      ["http://roblox.com/groups/5", "https://roblox.com/groups/5"],
      ["umich.edu", "https://umich.edu"],
      ["https://campusinfo.umich.edu/maps", "https://campusinfo.umich.edu/maps"],
    ]) {
      const r = normalizeLink(input, SITE);
      assert.deepEqual(r, { link: out }, input);
      if (out) assert.ok(DB_RULE(out), `database accepts ${out}`);
    }
  });

  it("rejects everything else", () => {
    for (const input of [
      "//evil.example/x",
      "/\\evil.example",
      "https://evil.example/",
      "https://roblox.com.evil.example/",
      "https://evilumich.edu/",
      "https://umich.edu@evil.example/",
      "https://roblox.com:8443/",
      "javascript:alert(1)",
      "ftp://umich.edu/",
      "/has space",
      `/${"a".repeat(600)}`,
      // Dot segments that resolve to "//host" (another site).
      "/..//evil.example",
      "/%2e%2e//evil.example",
      "https://robloxatum.vercel.app/..//evil.example",
    ]) {
      assert.ok("error" in normalizeLink(input, SITE), input);
    }
  });
});

describe("dismissKey", () => {
  it("is per announcement", () => {
    assert.notEqual(dismissKey("a"), dismissKey("b"));
  });
});
