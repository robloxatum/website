// The About page: what officers may save (story, timeline) and the founders in code. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FOUNDERS } from "../src/content/founders.ts";
import { initials, LIMITS, normalizeAbout } from "../src/lib/site-content.ts";

const ok = (raw) => {
  const r = normalizeAbout(raw);
  assert.ok("ok" in r, r.error);
  return r.ok;
};
const err = (raw) => {
  const r = normalizeAbout(raw);
  assert.ok("error" in r, "expected an error");
  return r.error;
};
const base = { story: "We started in 2025.", timeline: [] };

describe("normalizeAbout", () => {
  it("cleans text and keeps the timeline order", () => {
    const a = ok({
      story: "  We   started\nin 2025.  ",
      timeline: [
        { date_label: " Oct 2025 ", title: "Founded", body: "" },
        { date_label: "Jan 2026", title: "First jam", body: " 72 hours " },
      ],
    });
    assert.deepEqual(a, {
      story: "We started in 2025.",
      timeline: [
        { date_label: "Oct 2025", title: "Founded", body: "" },
        { date_label: "Jan 2026", title: "First jam", body: "72 hours" },
      ],
    });
  });

  it("ignores people sent by an old editor (founders live in code now)", () => {
    const a = ok({ ...base, people: [{ name: "A", role: "R", roblox_username: "builderman" }] });
    assert.equal("people" in a, false);
  });

  it("requires a story, dates and titles", () => {
    assert.match(err({ ...base, story: "  " }), /Story/);
    assert.match(err({ ...base, timeline: [{ date_label: "", title: "x" }] }), /Timeline item 1 date/);
    assert.match(err({ ...base, timeline: [{ date_label: "2025", title: "" }] }), /Timeline item 1 title/);
  });

  it("plain text only, within limits", () => {
    assert.match(err({ ...base, story: "<script>alert(1)</script>" }), /plain text/);
    assert.match(err({ ...base, timeline: [{ date_label: "a", title: "<b>x</b>" }] }), /plain text/);
    assert.match(err({ ...base, story: "x".repeat(LIMITS.story + 1) }), /keep it to 1200/);
    assert.match(err({ ...base, timeline: Array(LIMITS.timeline + 1).fill({ date_label: "a", title: "b" }) }), /Up to 30/);
  });

  it("refuses malformed input", () => {
    assert.match(err({ ...base, timeline: "nope" }), /timeline/);
    assert.match(err(null), /Story/);
  });
});

describe("founders (src/content/founders.ts)", () => {
  it("are exactly the four cofounders, in order, with valid Roblox usernames and empty one-liners", () => {
    assert.deepEqual(
      FOUNDERS.map((f) => [f.name, f.role, f.robloxUsername]),
      [
        ["Alexander Villagomez", "Cofounder", "vaillex"],
        ["Emily Garcia", "Cofounder", "yayy_drpepper"],
        ["Evan Stocker", "Cofounder", "FinestBuilds"],
        ["Kaden Chirco", "Cofounder", "noblemaxx"],
      ],
    );
    for (const f of FOUNDERS) {
      assert.match(f.robloxUsername, /^[A-Za-z0-9_]{3,20}$/, f.name);
      assert.equal(f.oneLiner ?? "", "", `${f.name}: one-liners are empty for now`);
    }
  });
});

describe("initials", () => {
  it("first and last initial, or one", () => {
    assert.equal(initials("Ada Lovelace"), "AL");
    assert.equal(initials("  mary  ann  smith "), "MS");
    assert.equal(initials("builderman"), "B");
    assert.equal(initials(""), "?");
  });
});
