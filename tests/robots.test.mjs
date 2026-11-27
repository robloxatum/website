// Security audit 3, I-10: robots.txt keeps search engines off the signed-in,
// officer, sign-in and check-in pages. Run: npm test
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { describe, it } from "node:test";
import robots from "../src/app/robots.ts";

describe("robots.txt", () => {
  it("allows the public pages and disallows the private ones", () => {
    const { rules } = robots();
    assert.equal(rules.userAgent, "*");
    assert.equal(rules.allow, "/");
    for (const p of ["/officer", "/profile", "/welcome", "/checkin", "/play", "/auth/", "/api/"]) assert.ok(rules.disallow.includes(p), p);
    for (const p of ["/", "/events", "/about", "/join", "/links", "/privacy", "/go/"]) {
      assert.ok(!rules.disallow.some((d) => p.startsWith(d)), `${p} stays indexable`);
    }
  });

  it("covers every signed-in page folder", () => {
    // Folders under (main) that aren't public must be listed (a new one fails here until it's decided).
    const PUBLIC = new Set(["about", "events", "install", "join", "links", "privacy"]);
    const folders = readdirSync(new URL("../src/app/(main)", import.meta.url), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const { disallow } = robots().rules;
    for (const f of folders) if (!PUBLIC.has(f)) assert.ok(disallow.includes(`/${f}`), `/${f} is in robots.ts or PUBLIC`);
  });

  it("asks not to index preview deployments at all", () => {
    const before = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "preview";
    try {
      assert.deepEqual(robots().rules, { userAgent: "*", disallow: "/" });
    } finally {
      if (before === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = before;
    }
  });
});
