// Live game links: what officers may post. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeGameLabel, normalizeGameLink } from "../src/lib/game-links.ts";

// Same rule as the database check (event_game_links_url_check).
const DB_RULE = /^https:\/\/(www\.)?roblox\.com\/[^\s"'<>\\]*$/;

describe("normalizeGameLink", () => {
  it("accepts Roblox private server and share links", () => {
    for (const [input, out] of [
      ["https://www.roblox.com/games/123/Obby?privateServerLinkCode=abc123", "https://www.roblox.com/games/123/Obby?privateServerLinkCode=abc123"],
      ["https://www.roblox.com/share?code=4f2a&type=Server", "https://www.roblox.com/share?code=4f2a&type=Server"],
      ["  www.roblox.com/share?code=4f2a&type=Server  ", "https://www.roblox.com/share?code=4f2a&type=Server"],
      ["http://roblox.com/games/1#about", "https://roblox.com/games/1"],
      ["HTTPS://WWW.ROBLOX.COM/games/1", "https://www.roblox.com/games/1"],
    ]) {
      const r = normalizeGameLink(input);
      assert.deepEqual(r, { url: out }, input);
      assert.match(r.url, DB_RULE, "passes the database check too");
    }
  });

  it("rejects everything that isn't roblox.com", () => {
    for (const input of [
      "",
      "not a link at all",
      "https://evil.example/roblox.com/games/1",
      "https://roblox.com.evil.example/games/1",
      "https://evilroblox.com/games/1",
      "https://web.roblox.com.attacker.io/x",
      "https://user:pass@roblox.com/games/1",
      "https://roblox.com:8443/games/1",
      "javascript:alert(1)//roblox.com",
      "ftp://roblox.com/games/1",
      "https://ro.blox.com/Ebh5",
      `https://roblox.com/${"a".repeat(600)}`,
    ]) {
      assert.ok("error" in normalizeGameLink(input), input);
    }
  });
});

describe("normalizeGameLabel", () => {
  it("trims, collapses spaces and treats empty as no label", () => {
    assert.deepEqual(normalizeGameLabel("  Server   1 "), { label: "Server 1" });
    assert.deepEqual(normalizeGameLabel("   "), { label: null });
    assert.ok("error" in normalizeGameLabel("x".repeat(61)));
  });
});
