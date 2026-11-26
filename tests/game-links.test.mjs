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

describe("multiple servers", async () => {
  const { defaultServerLabel, moveId, sortServers, suggestServer } = await import("../src/lib/game-links.ts");
  const srv = (id, is_full = false, position = 0) => ({ id, url: "https://roblox.com/x", label: id, is_full, position });

  it("names the next server after the highest Server N", () => {
    assert.equal(defaultServerLabel([]), "Server 1");
    assert.equal(defaultServerLabel([{ label: "Server 1" }]), "Server 2");
    assert.equal(defaultServerLabel([{ label: "Team Red" }, { label: "Team Blue" }]), "Server 3");
    assert.equal(defaultServerLabel([{ label: "Server 4" }]), "Server 5");
  });

  it("sorts by position, then oldest first", () => {
    const list = [
      { id: "c", position: 1, created_at: "2026-01-01T00:00:00Z" },
      { id: "b", position: 0, created_at: "2026-01-02T00:00:00Z" },
      { id: "a", position: 0, created_at: "2026-01-01T00:00:00Z" },
    ];
    assert.deepEqual(sortServers(list).map((s) => s.id), ["a", "b", "c"]);
  });

  it("moves one place up or down, never off the ends", () => {
    assert.deepEqual(moveId(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
    assert.deepEqual(moveId(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
    assert.deepEqual(moveId(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
    assert.deepEqual(moveId(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
    assert.deepEqual(moveId(["a", "b"], "zzz", 1), ["a", "b"]);
  });

  it("spreads members evenly over open servers by check-in order", () => {
    const servers = [srv("s1"), srv("s2", true), srv("s3"), srv("s4")];
    const picks = [1, 2, 3, 4, 5, 6].map((n) => suggestServer(servers, n)?.id);
    assert.deepEqual(picks, ["s1", "s3", "s4", "s1", "s3", "s4"]);
    const counts = {};
    for (let n = 1; n <= 30; n++) counts[suggestServer(servers, n).id] = (counts[suggestServer(servers, n).id] ?? 0) + 1;
    assert.deepEqual(counts, { s1: 10, s3: 10, s4: 10 });
  });

  it("suggests nothing without a real choice or a check-in order", () => {
    assert.equal(suggestServer([srv("s1")], 1), null);
    assert.equal(suggestServer([srv("s1"), srv("s2", true)], 1), null);
    assert.equal(suggestServer([srv("s1"), srv("s2")], null), null);
    assert.equal(suggestServer([srv("s1"), srv("s2")], 0), null);
    assert.equal(suggestServer([], 3), null);
  });
});
