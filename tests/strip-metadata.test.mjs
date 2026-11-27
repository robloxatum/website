// Security audit 3, L-1: flyer and cover uploads lose their metadata (GPS,
// camera, XMP, comments) but keep their pixels and rotation. Run: npm test
// Test images are made with sharp (installed with Next for image optimization).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { sniffImageType, stripImageMetadata } from "../src/lib/strip-metadata.ts";

const sharp = createRequire(import.meta.url)("sharp");

const GPS = { GPSLatitudeRef: "N", GPSLatitude: "42/1 16/1 3012/100", GPSLongitudeRef: "W", GPSLongitude: "83/1 44/1 1/1" };
const EXIF = { IFD0: { Make: "SyntheticCam", Model: "AUD3-Model", Copyright: "secret-owner" }, IFD3: GPS };
const XMP = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="42,16.5N"/></rdf:RDF></x:xmpmeta>';

/** A 64×40 gradient with a few coloured blocks, so pixel checks mean something. */
function picture() {
  const w = 64, h = 40, px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set([x * 4, y * 6, (x * y) % 256], (y * w + x) * 3);
  return sharp(px, { raw: { width: w, height: h, channels: 3 } });
}

const leaks = (b) =>
  ["Exif\0\0", "SyntheticCam", "AUD3-Model", "secret-owner", "xmpmeta", "GPSLatitude", "a-comment", "tEXt", "zTXt", "iTXt", "eXIf"].filter((s) =>
    Buffer.from(b).includes(Buffer.from(s)),
  );

const raw = async (b) => (await sharp(Buffer.from(b)).raw().toBuffer({ resolveWithObject: true }));

async function samePixels(a, b) {
  const [x, y] = await Promise.all([raw(a), raw(b)]);
  assert.deepEqual([y.info.width, y.info.height], [x.info.width, x.info.height]);
  assert.ok(x.data.equals(y.data), "pixels unchanged");
}

/** Inserts a JPEG segment right after SOI. */
const withSegment = (jpeg, marker, payload) => {
  const len = payload.length + 2;
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, marker, len >> 8, len & 0xff]), payload, jpeg.subarray(2)]);
};

describe("stripImageMetadata: JPEG", () => {
  for (const progressive of [false, true]) {
    it(`removes EXIF (GPS, camera), XMP and comments from a ${progressive ? "progressive" : "baseline"} JPEG, pixels unchanged`, async () => {
      let jpeg = await picture().jpeg({ progressive }).withExif(EXIF).withXmp(XMP).toBuffer();
      jpeg = withSegment(jpeg, 0xfe, Buffer.from("a-comment"));
      jpeg = withSegment(jpeg, 0xed, Buffer.from("Photoshop 3.0\0secret-owner"));
      assert.deepEqual(leaks(jpeg).sort(), ["AUD3-Model", "Exif\0\0", "GPSLatitude", "SyntheticCam", "a-comment", "secret-owner", "xmpmeta"].sort());
      const clean = stripImageMetadata(jpeg, "image/jpeg");
      assert.ok(clean);
      assert.deepEqual(leaks(clean), []);
      const meta = await sharp(Buffer.from(clean)).metadata();
      assert.equal(meta.exif, undefined);
      assert.equal(meta.xmp, undefined);
      await samePixels(jpeg, clean);
    });
  }

  it("keeps only the rotation from EXIF, so phone photos stay upright", async () => {
    const jpeg = await picture().jpeg().withMetadata({ orientation: 6 }).withExif({ IFD0: { Make: "SyntheticCam" }, IFD3: GPS }).toBuffer();
    assert.equal((await sharp(jpeg).metadata()).orientation, 6);
    const clean = stripImageMetadata(jpeg, "image/jpeg");
    assert.deepEqual(leaks(clean).filter((s) => s !== "Exif\0\0"), []);
    const meta = await sharp(Buffer.from(clean)).metadata();
    assert.equal(meta.orientation, 6);
    assert.ok(meta.exif.length < 40, "a minimal EXIF block");
    const [a, b] = await Promise.all([sharp(jpeg).rotate().raw().toBuffer(), sharp(Buffer.from(clean)).rotate().raw().toBuffer()]);
    assert.ok(a.equals(b), "shown the same way");
  });

  it("keeps the ICC colour profile", async () => {
    const jpeg = await picture().jpeg().withIccProfile("p3").withExif(EXIF).toBuffer();
    const clean = stripImageMetadata(jpeg, "image/jpeg");
    assert.ok((await sharp(Buffer.from(clean)).metadata()).icc, "ICC kept");
    assert.deepEqual(leaks(clean), []);
  });

  it("drops a second picture appended after the image (with its own EXIF)", async () => {
    const main = await picture().jpeg().toBuffer();
    const extra = await picture().jpeg().withExif(EXIF).toBuffer();
    const clean = stripImageMetadata(Buffer.concat([main, extra]), "image/jpeg");
    assert.deepEqual(leaks(clean), []);
    assert.equal(clean.length, main.length);
  });

  it("refuses truncated or non-JPEG data", async () => {
    const jpeg = await picture().jpeg().toBuffer();
    for (const bad of [jpeg.subarray(0, 40), jpeg.subarray(0, jpeg.length - 200), Buffer.from("not an image"), new Uint8Array()]) {
      assert.equal(stripImageMetadata(bad, "image/jpeg"), null);
    }
    assert.equal(stripImageMetadata(await picture().png().toBuffer(), "image/jpeg"), null);
  });
});

describe("stripImageMetadata: PNG", () => {
  it("removes eXIf, text and XMP chunks; pixels and transparency unchanged", async () => {
    const png = await picture().ensureAlpha(0.5).png().withExif(EXIF).withXmp(XMP).withMetadata().toBuffer();
    // A tEXt chunk too (sharp doesn't write one), with a valid CRC.
    const text = pngChunk("tEXt", Buffer.from("Comment\0a-comment"));
    const withText = Buffer.concat([png.subarray(0, 33), text, png.subarray(33)]);
    assert.ok(leaks(withText).length >= 3);
    const clean = stripImageMetadata(withText, "image/png");
    assert.ok(clean);
    assert.deepEqual(leaks(clean), []);
    assert.equal((await sharp(Buffer.from(clean)).metadata()).hasAlpha, true);
    await samePixels(withText, clean);
  });

  it("refuses truncated data", async () => {
    const png = await picture().png().toBuffer();
    assert.equal(stripImageMetadata(png.subarray(0, png.length - 12), "image/png"), null);
  });
});

describe("stripImageMetadata: WebP", () => {
  it("removes EXIF and XMP chunks and their flags; pixels unchanged", async () => {
    const webp = await picture().webp({ lossless: true }).withExif(EXIF).withXmp(XMP).toBuffer();
    assert.ok(leaks(webp).length >= 3);
    const clean = stripImageMetadata(webp, "image/webp");
    assert.ok(clean);
    assert.deepEqual(leaks(clean), []);
    const b = Buffer.from(clean);
    assert.equal(b.readUInt32LE(4), b.length - 8, "RIFF size updated");
    const meta = await sharp(b).metadata();
    assert.equal(meta.exif, undefined);
    await samePixels(webp, clean);
  });
});

describe("sniffImageType", () => {
  it("reads the type from the bytes, not the name", async () => {
    assert.equal(sniffImageType(await picture().jpeg().toBuffer()), "image/jpeg");
    assert.equal(sniffImageType(await picture().png().toBuffer()), "image/png");
    assert.equal(sniffImageType(await picture().webp().toBuffer()), "image/webp");
    assert.equal(sniffImageType(await picture().gif().toBuffer()), null);
    assert.equal(sniffImageType(Buffer.from("<svg/>")), null);
  });
});

function pngChunk(name, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(name, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
