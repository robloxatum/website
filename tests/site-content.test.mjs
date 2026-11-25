// Officer-editable site content: links, FAQ, what we do, featured panel. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOT_SEGMENT,
  HTTPS_URL,
  LIMITS,
  SITE_PATH,
  cleanText,
  linkPlatform,
  normalizeFaq,
  normalizeFeatured,
  normalizeFeaturedHref,
  normalizeHttpsUrl,
  normalizeLinks,
  normalizeWhatWeDo,
} from "../src/lib/site-content.ts";

const SITE = ["robloxatum.vercel.app", "localhost"];
const ok = (r) => {
  assert.ok("ok" in r, `expected ok, got ${JSON.stringify(r)}`);
  return r.ok;
};
const err = (r) => {
  assert.ok("error" in r, `expected an error, got ${JSON.stringify(r)}`);
  return r.error;
};
// Same rules as the database checks (20261205000000_site_content.sql).
const DB_URL = (u) => u.length <= 500 && HTTPS_URL.test(u);
const DB_HREF = (h) => h.length <= 500 && ((SITE_PATH.test(h) && !DOT_SEGMENT.test(h)) || HTTPS_URL.test(h));

describe("normalizeHttpsUrl", () => {
  it("keeps the seeded links exactly as they are", () => {
    for (const url of [
      "https://www.instagram.com/michiganrobloxclub",
      "https://groupme.com/join_group/110761275/29bjlQWA",
      "https://discord.gg/83Xtc9TJtA",
      "https://www.roblox.com/share/g/498559567",
      "https://www.linkedin.com/company/roblox-at-um",
      "https://maizepages.umich.edu/organization/roblox-at-um",
    ]) {
      assert.equal(ok(normalizeHttpsUrl(url)), url);
      assert.ok(DB_URL(url), url);
    }
  });

  it("adds https:// and lowercases the host", () => {
    assert.equal(ok(normalizeHttpsUrl("  discord.gg/abc ")), "https://discord.gg/abc");
    assert.equal(ok(normalizeHttpsUrl("HTTPS://WWW.Example.COM/Path?q=1#x")), "https://www.example.com/Path?q=1#x");
    assert.equal(ok(normalizeHttpsUrl("https://example.com/")), "https://example.com");
  });

  it("refuses anything that isn't https", () => {
    for (const bad of [
      "http://example.com",
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "mailto:a@b.com",
      "data:text/html,hi",
      "ftp://example.com",
      "//example.com",
      "https://user:pw@example.com",
      "https://example.com:8443/x",
      "https://localhost",
      "",
      "   ",
    ]) {
      err(normalizeHttpsUrl(bad));
    }
  });

  it("never returns something the database would refuse", () => {
    for (const raw of ["example.com/a b", 'example.com/"x"', "example.com/<b>", "https://ex.com/a\\b", "münchen.de/ä"]) {
      const r = normalizeHttpsUrl(raw);
      if ("ok" in r) assert.ok(DB_URL(r.ok), `${raw} -> ${r.ok}`);
    }
  });
});

describe("normalizeLinks", () => {
  const link = { label: " Discord ", url: "discord.gg/x", blurb: "  Hang   out ", visible: true };

  it("cleans each link and keeps the order", () => {
    assert.deepEqual(ok(normalizeLinks([link, { ...link, label: "B", visible: false }])), [
      { label: "Discord", url: "https://discord.gg/x", blurb: "Hang out", visible: true },
      { label: "B", url: "https://discord.gg/x", blurb: "Hang out", visible: false },
    ]);
  });

  it("allows an empty description, not an empty label or URL", () => {
    assert.equal(ok(normalizeLinks([{ ...link, blurb: "" }]))[0].blurb, "");
    assert.match(err(normalizeLinks([{ ...link, label: " " }])), /Link 1 label/);
    assert.match(err(normalizeLinks([link, { ...link, url: "http://x.com" }])), /Link 2 \(Discord\) URL: use an https/);
  });

  it("enforces limits and plain text", () => {
    err(normalizeLinks([{ ...link, label: "x".repeat(LIMITS.label + 1) }]));
    err(normalizeLinks([{ ...link, blurb: "x".repeat(LIMITS.blurb + 1) }]));
    err(normalizeLinks(Array.from({ length: LIMITS.links + 1 }, () => link)));
    assert.match(err(normalizeLinks([{ ...link, label: "<b>Hi</b>" }])), /plain text/);
    assert.match(err(normalizeLinks([{ ...link, blurb: "<img src=x onerror=alert(1)>" }])), /plain text/);
    assert.equal(ok(normalizeLinks([{ ...link, blurb: "We <3 Roblox" }]))[0].blurb, "We <3 Roblox");
    err(normalizeLinks("nope"));
    assert.deepEqual(ok(normalizeLinks([])), []);
  });
});

describe("FAQ and what we do", () => {
  it("cleans questions, collapsing line breaks", () => {
    assert.deepEqual(ok(normalizeFaq([{ question: " Cost? ", answer: "Free.\n\nAlways." }])), [
      { question: "Cost?", answer: "Free. Always." },
    ]);
    assert.match(err(normalizeFaq([{ question: "Q", answer: "" }])), /Answer to question 1/);
    assert.match(err(normalizeFaq([{ question: "<script>x</script>", answer: "a" }])), /plain text/);
    err(normalizeFaq([{ question: "q", answer: "x".repeat(LIMITS.answer + 1) }]));
    err(normalizeFaq(Array.from({ length: LIMITS.faq + 1 }, () => ({ question: "q", answer: "a" }))));
  });

  it("needs all four what-we-do cards, returned in the fixed order", () => {
    const cards = ["workshop", "game_jam", "social", "game_night"].map((key) => ({ key, title: ` ${key} `, body: "b" }));
    assert.deepEqual(
      ok(normalizeWhatWeDo(cards)).map((c) => [c.key, c.title]),
      [["game_night", "game_night"], ["social", "social"], ["game_jam", "game_jam"], ["workshop", "workshop"]],
    );
    err(normalizeWhatWeDo(cards.slice(1)));
    err(normalizeWhatWeDo(cards.map((c) => ({ ...c, title: "" }))));
  });
});

describe("featured panel", () => {
  const f = { enabled: true, title: "Jam", body: "Teams built games.", link_text: "Join", link_href: "/join" };

  it("accepts a site path or an https link; full links to our site become paths", () => {
    assert.equal(ok(normalizeFeaturedHref("/join", SITE)), "/join");
    assert.equal(ok(normalizeFeaturedHref("/events?tab=past#x", SITE)), "/events?tab=past#x");
    assert.equal(ok(normalizeFeaturedHref("https://robloxatum.vercel.app/events", SITE)), "/events");
    assert.equal(ok(normalizeFeaturedHref("www.roblox.com/games/1", SITE)), "https://www.roblox.com/games/1");
  });

  it("refuses links that could leave the site in disguise", () => {
    for (const bad of [
      "//evil.com",
      "/\\evil.com",
      "/..//evil.com",
      "/%2e%2e//evil.com",
      "/./x",
      "/a/../b",
      "javascript:alert(1)",
      "http://example.com",
      "/a b",
      "https://robloxatum.vercel.app//evil.com",
    ]) {
      err(normalizeFeaturedHref(bad, SITE));
    }
    for (const bad of ["//evil.com", "/..//evil.com", "/%2E%2E//evil.com", "/a/./b"]) assert.ok(!DB_HREF(bad), `DB accepts ${bad}`);
  });

  it("needs link text and link together (or neither)", () => {
    assert.deepEqual(ok(normalizeFeatured(f, SITE)), f);
    assert.deepEqual(ok(normalizeFeatured({ ...f, link_text: " ", link_href: "" }, SITE)), { ...f, link_text: null, link_href: null });
    assert.match(err(normalizeFeatured({ ...f, link_text: "" }, SITE)), /link text/);
    assert.match(err(normalizeFeatured({ ...f, link_href: "" }, SITE)), /Featured link:/);
    assert.equal(ok(normalizeFeatured({ ...f, enabled: "yes" }, SITE)).enabled, false);
    err(normalizeFeatured({ ...f, title: "" }, SITE));
    err(normalizeFeatured({ ...f, body: "<a href=x>hi</a>" }, SITE));
  });
});

describe("helpers", () => {
  it("cleanText trims and collapses whitespace", () => {
    assert.equal(cleanText("  a \n\t b  "), "a b");
    assert.equal(cleanText(null), "");
  });

  it("recognizes community sites for icons and wording", () => {
    assert.equal(linkPlatform("https://www.instagram.com/x"), "instagram");
    assert.equal(linkPlatform("https://discord.gg/x"), "discord");
    assert.equal(linkPlatform("https://discord.com/invite/x"), "discord");
    assert.equal(linkPlatform("https://maizepages.umich.edu/organization/x"), "maizepages");
    assert.equal(linkPlatform("https://www.roblox.com/share/g/1"), "roblox");
    assert.equal(linkPlatform("https://notinstagram.com"), null);
    assert.equal(linkPlatform("https://example.com"), null);
    assert.equal(linkPlatform("not a url"), null);
  });
});
