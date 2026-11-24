// Flyer short links (/go/<slug>). Run: npm test
// Optional live check against a running server:
//   SHORTLINK_BASE_URL=http://localhost:3000 npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shortlinks } from "../src/content/shortlinks.ts";
import { resolveShortlink, shortlinkRedirect } from "../src/lib/shortlinks.ts";

const ORIGIN = "https://robloxatum.vercel.app";
const gameover = shortlinks.find((l) => l.slug === "gameover");

function redirect(segments, now, links = shortlinks) {
  const res = shortlinkRedirect(links, segments, now, `${ORIGIN}/go/${(segments ?? []).join("/")}`);
  return { status: res.status, location: res.headers.get("location"), cache: res.headers.get("cache-control") };
}

function assertRedirect(r, path) {
  assert.equal(r.status, 307, "temporary redirect, never permanent");
  assert.equal(r.location, `${ORIGIN}${path}`);
  assert.match(r.cache, /no-store/);
}

describe("/go/gameover", () => {
  it("is configured as printed on the flyer", () => {
    assert.ok(gameover, "the printed QR points at /go/gameover");
    assert.equal(gameover.target, "/join?src=flyer-gameover");
    assert.equal(gameover.expiresAt, "2026-12-11T00:00:00-05:00");
    assert.equal(gameover.afterExpiry, "/");
  });

  it("goes to /join?src=flyer-gameover before it expires", () => {
    for (const now of ["2026-11-24T12:00:00-05:00", "2026-12-10T23:59:59.999-05:00", "2026-12-11T04:59:59.999Z"]) {
      assertRedirect(redirect(["gameover"], new Date(now)), "/join?src=flyer-gameover");
    }
  });

  it("goes home from the expiry instant on (midnight Eastern, Dec 11)", () => {
    for (const now of ["2026-12-11T00:00:00-05:00", "2026-12-11T05:00:00Z", "2026-12-11T00:00:01-05:00", "2027-06-01T12:00:00Z"]) {
      assertRedirect(redirect(["gameover"], new Date(now)), "/");
    }
  });

  it("ignores letter case", () => {
    assertRedirect(redirect(["GameOver"], new Date("2026-12-01T12:00:00-05:00")), "/join?src=flyer-gameover");
  });
});

describe("anything else under /go", () => {
  const now = new Date("2026-12-01T12:00:00-05:00");
  it("sends unknown slugs, /go and /go/a/b home", () => {
    for (const segments of [["nope"], [""], undefined, [], ["gameover", "extra"]]) assertRedirect(redirect(segments, now), "/");
  });

  it("never redirects off-site, even if the config is wrong", () => {
    const bad = [
      { slug: "a", target: "//evil.example/x", expiresAt: "2099-01-01T00:00:00Z", afterExpiry: "/" },
      { slug: "b", target: "https://evil.example", expiresAt: "2099-01-01T00:00:00Z", afterExpiry: "/" },
      { slug: "c", target: "/\\evil.example", expiresAt: "2099-01-01T00:00:00Z", afterExpiry: "/" },
      { slug: "d", target: "/join", expiresAt: "not a date", afterExpiry: "/" },
    ];
    for (const slug of ["a", "b", "c", "d"]) assertRedirect(redirect([slug], now, bad), "/");
  });
});

describe("shortlinks config", () => {
  it("has unique, well-formed entries", () => {
    const slugs = shortlinks.map((l) => l.slug);
    assert.equal(new Set(slugs).size, slugs.length, "slugs are unique");
    for (const l of shortlinks) {
      assert.match(l.slug, /^[a-z0-9_-]+$/, `${l.slug}: slug characters`);
      assert.match(l.expiresAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/, `${l.slug}: expiresAt needs a time zone`);
      assert.ok(Number.isFinite(Date.parse(l.expiresAt)), `${l.slug}: expiresAt parses`);
      for (const p of [l.target, l.afterExpiry]) assert.equal(resolveShortlink([{ ...l, target: p, expiresAt: "2999-01-01T00:00:00Z" }], l.slug, new Date()), p, `${l.slug}: ${p} is a site path`);
      if (new URL(l.target, ORIGIN).pathname === "/join") assert.ok(new URL(l.target, ORIGIN).searchParams.get("src"), `${l.slug}: /join target has ?src=`);
    }
  });
});

const live = process.env.SHORTLINK_BASE_URL;
describe("live route", { skip: !live && "set SHORTLINK_BASE_URL to check a running server" }, () => {
  const get = (p) => fetch(`${live}${p}`, { redirect: "manual" });
  it("redirects /go/gameover with a 307 and no-store", async () => {
    const res = await get("/go/gameover");
    assert.equal(res.status, 307);
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    const expected = resolveShortlink(shortlinks, "gameover", new Date());
    assert.equal(new URL(res.headers.get("location")).pathname + new URL(res.headers.get("location")).search, expected);
  });
  it("sends unknown slugs, /go and /go/a/b home", async () => {
    for (const p of ["/go/does-not-exist", "/go", "/go/gameover/extra"]) {
      const res = await get(p);
      assert.equal(res.status, 307, p);
      assert.equal(new URL(res.headers.get("location")).pathname, "/", p);
    }
  });
});
