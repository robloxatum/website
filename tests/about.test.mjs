// The About page content (story, timeline, founders): what officers may save. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
const base = { story: "We started in 2025.", timeline: [], people: [] };

describe("normalizeAbout", () => {
  it("cleans text, keeps order, drops @ from usernames, empty username → null", () => {
    const a = ok({
      story: "  We   started\nin 2025.  ",
      timeline: [
        { date_label: " Oct 2025 ", title: "Founded", body: "" },
        { date_label: "Jan 2026", title: "First jam", body: " 72 hours " },
      ],
      people: [
        { name: " Ada  Lovelace ", role: "Co-founder", roblox_username: "@builderman", blurb: "", visible: true },
        { name: "Bo", role: "Treasurer", roblox_username: "  ", blurb: "Hi", visible: false },
      ],
    });
    assert.equal(a.story, "We started in 2025.");
    assert.deepEqual(a.timeline, [
      { date_label: "Oct 2025", title: "Founded", body: "" },
      { date_label: "Jan 2026", title: "First jam", body: "72 hours" },
    ]);
    assert.deepEqual(a.people, [
      { name: "Ada Lovelace", role: "Co-founder", roblox_username: "builderman", blurb: "", visible: true },
      { name: "Bo", role: "Treasurer", roblox_username: null, blurb: "Hi", visible: false },
    ]);
  });

  it("never takes a Roblox user ID from the browser", () => {
    const a = ok({ ...base, people: [{ name: "A", role: "R", roblox_username: "builderman", roblox_user_id: 999, visible: true }] });
    assert.equal("roblox_user_id" in a.people[0], false);
  });

  it("requires a story, dates, titles, names and roles", () => {
    assert.match(err({ ...base, story: "  " }), /Story/);
    assert.match(err({ ...base, timeline: [{ date_label: "", title: "x" }] }), /Timeline item 1 date/);
    assert.match(err({ ...base, timeline: [{ date_label: "2025", title: "" }] }), /Timeline item 1 title/);
    assert.match(err({ ...base, people: [{ name: "", role: "x" }] }), /Person 1 name/);
    assert.match(err({ ...base, people: [{ name: "A", role: "" }] }), /Person 1 \(A\) role/);
  });

  it("plain text only, within limits", () => {
    assert.match(err({ ...base, story: "<script>alert(1)</script>" }), /plain text/);
    assert.match(err({ ...base, people: [{ name: "<b>A</b>", role: "x" }] }), /plain text/);
    assert.match(err({ ...base, story: "x".repeat(LIMITS.story + 1) }), /keep it to 1200/);
    assert.match(err({ ...base, timeline: Array(LIMITS.timeline + 1).fill({ date_label: "a", title: "b" }) }), /Up to 30/);
    assert.match(err({ ...base, people: Array(LIMITS.people + 1).fill({ name: "a", role: "b" }) }), /Up to 24/);
  });

  it("refuses Roblox usernames Roblox wouldn't allow", () => {
    for (const u of ["ab", "a".repeat(21), "has space", "bad-dash", "émile"]) {
      assert.match(err({ ...base, people: [{ name: "A", role: "R", roblox_username: u }] }), /Roblox username/, u);
    }
  });

  it("refuses malformed input", () => {
    assert.match(err({ ...base, timeline: "nope" }), /timeline/);
    assert.match(err({ ...base, people: null }), /people/);
    assert.match(err(null), /Story/);
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
