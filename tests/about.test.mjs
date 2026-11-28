// The About page: what officers may save (story, timeline) and the founders in code. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FOUNDERS, isLinkedInProfileUrl } from "../src/content/founders.ts";
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

describe("founder LinkedIn links", () => {
  it("each founder links to their own LinkedIn profile", () => {
    assert.deepEqual(
      FOUNDERS.map((f) => [f.name, f.linkedin]),
      [
        ["Alexander Villagomez", "https://www.linkedin.com/in/alexander-villagomez/"],
        ["Emily Garcia", "https://www.linkedin.com/in/emily-garcia-647678381/"],
        ["Evan Stocker", "https://www.linkedin.com/in/evanstocker/"],
        ["Kaden Chirco", "https://www.linkedin.com/in/kaden-chirco-01a8552b1/"],
      ],
    );
    for (const f of FOUNDERS) {
      assert.ok(f.linkedin === undefined || isLinkedInProfileUrl(f.linkedin), `${f.name}: not a LinkedIn profile URL`);
      // The Roblox username stays private: not hidden in the LinkedIn link either.
      assert.ok(!f.linkedin?.toLowerCase().includes(f.robloxUsername.toLowerCase()), f.name);
    }
  });

  it("allows only https://www.linkedin.com/in/<profile> URLs", () => {
    for (const good of [
      "https://www.linkedin.com/in/evanstocker/",
      "https://www.linkedin.com/in/evanstocker",
      "https://www.linkedin.com/in/kaden-chirco-01a8552b1/",
      "https://www.linkedin.com/in/some_one/",
    ]) {
      assert.equal(isLinkedInProfileUrl(good), true, good);
    }
    for (const bad of [
      undefined,
      null,
      42,
      "",
      "http://www.linkedin.com/in/evanstocker/", // not https
      "https://linkedin.com/in/evanstocker/", // not www
      "https://www.linkedin.com.evil.com/in/evanstocker/",
      "https://evil.com/?u=https://www.linkedin.com/in/x/",
      "https://www.linkedin.com/company/roblox-at-um/", // not a profile
      "https://www.linkedin.com/in/", // no profile
      "https://www.linkedin.com/in/a/b/",
      "https://www.linkedin.com/in/../company/x",
      "https://www.linkedin.com/in/x?redirect=https://evil.com",
      "https://www.linkedin.com/in/x#top",
      "https://user:pw@www.linkedin.com/in/x/",
      "https://www.linkedin.com:8443/in/x/",
      "https://WWW.LINKEDIN.COM/in/x/", // only the exact spelling
      " https://www.linkedin.com/in/x/",
      "javascript:alert(1)//https://www.linkedin.com/in/x/",
      "//www.linkedin.com/in/x/",
    ]) {
      assert.equal(isLinkedInProfileUrl(bad), false, String(bad));
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
