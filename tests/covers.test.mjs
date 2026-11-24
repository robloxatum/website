// Default event covers: build-time manifest and the per-event pick. Run: npm test
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { imageSize, readCoverManifest } from "../src/lib/cover-manifest.ts";
import { assignDefaultCovers, defaultCoverSrc, hashId, preferredCover } from "../src/lib/covers.ts";

const COVERS_DIR = new URL("../public/art/covers/", import.meta.url).pathname;
const ids = (n) => Array.from({ length: n }, () => randomUUID());

describe("cover manifest", () => {
  const manifest = readCoverManifest(COVERS_DIR);

  it("lists every image in public/art/covers, sorted, with its real size", () => {
    assert.ok(manifest.length >= 7, "the seven committed covers");
    assert.deepEqual(manifest.map((c) => c.file), [...manifest.map((c) => c.file)].sort());
    for (const c of manifest) {
      assert.match(c.file, /\.(webp|png|jpe?g)$/i);
      assert.ok(c.width >= 1200 && c.height >= 600, `${c.file} is at least 1200 x 600`);
      assert.equal(c.width / c.height, 2, `${c.file} is 2:1`);
    }
  });

  it("returns [] for a missing folder instead of failing the build", () => {
    assert.deepEqual(readCoverManifest("/nonexistent/covers"), []);
  });

  it("reads PNG and JPEG sizes too", () => {
    const png = Buffer.alloc(24);
    png.write("\x89PNG\r\n\x1a\n", 0, "latin1");
    png.writeUInt32BE(1600, 16);
    png.writeUInt32BE(800, 20);
    assert.deepEqual(imageSize(png), { width: 1600, height: 800 });

    // SOI, an APP0 segment, then SOF0 with height 600 / width 1200.
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x04, 0xb0, 0x03]);
    assert.deepEqual(imageSize(jpg), { width: 1200, height: 600 });
    assert.equal(imageSize(Buffer.from("not an image")), null);
  });

  it("builds URLs under /art/covers", () => {
    assert.equal(defaultCoverSrc({ file: "sky-citadel.webp", width: 1600, height: 800 }), "/art/covers/sky-citadel.webp");
  });
});

describe("default cover pick", () => {
  it("is stable for an event ID (same image on every request)", () => {
    const id = "3f6c1d2e-8a4b-4c5d-9e0f-112233445566";
    assert.equal(hashId(id), hashId(id));
    assert.equal(preferredCover(id, 7), preferredCover(id, 7));
    assert.deepEqual(assignDefaultCovers([id], 7), [preferredCover(id, 7)]);
  });

  it("spreads events across the covers", () => {
    const seen = new Set(ids(200).map((id) => preferredCover(id, 7)));
    assert.equal(seen.size, 7);
  });

  it("never puts the same image on two cards in a row", () => {
    for (let trial = 0; trial < 200; trial++) {
      const list = ids(12);
      const picks = assignDefaultCovers(list, 7);
      assert.deepEqual(assignDefaultCovers(list, 7), picks, "same list, same picks");
      for (let i = 1; i < picks.length; i++) assert.notEqual(picks[i], picks[i - 1]);
      for (const p of picks) assert.ok(p >= 0 && p < 7);
    }
  });

  it("keeps an event's own pick unless its neighbour already has it", () => {
    const list = ids(30);
    const picks = assignDefaultCovers(list, 7);
    list.forEach((id, i) => {
      if (i === 0 || preferredCover(id, 7) !== picks[i - 1]) assert.equal(picks[i], preferredCover(id, 7));
    });
  });

  it("works with two covers (alternates) and one cover (repeats)", () => {
    const two = assignDefaultCovers(ids(10), 2);
    for (let i = 1; i < two.length; i++) assert.notEqual(two[i], two[i - 1]);
    assert.deepEqual(assignDefaultCovers(ids(3), 1), [0, 0, 0]);
    assert.deepEqual(assignDefaultCovers(ids(3), 0), [-1, -1, -1]);
  });

  it("skips events with an uploaded cover and doesn't count them as neighbours", () => {
    const [a, b] = ids(2);
    const picks = assignDefaultCovers([a, null, b], 7);
    assert.equal(picks[1], -1);
    assert.equal(picks[0], preferredCover(a, 7));
    assert.equal(picks[2], preferredCover(b, 7));
  });
});
