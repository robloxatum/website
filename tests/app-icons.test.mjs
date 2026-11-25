// Home-screen app icons (made by scripts/make-app-icons.py): plain full-bleed
// navy squares, no rounded corners, border or transparency (iOS and Android
// round them), with the logo centred at ~65% of the width (~60% for maskable,
// inside Android's safe zone).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inflateSync } from "node:zlib";

const NAVY = [6, 21, 37];

/** Minimal PNG reader: 8-bit RGB or RGBA, not interlaced (what the script writes). */
function readPng(path) {
  const buf = readFileSync(path);
  assert.equal(buf.toString("latin1", 1, 4), "PNG", `${path} is a PNG`);
  let pos = 8;
  let width = 0, height = 0, colorType = -1;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, `${path}: 8-bit`);
      colorType = data[9];
      assert.equal(data[12], 0, `${path}: not interlaced`);
    } else if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  assert.ok(colorType === 2 || colorType === 6, `${path}: RGB or RGBA (got color type ${colorType})`);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      px[y * stride + x] = (v + pred) & 0xff;
    }
  }
  const at = (x, y) => {
    const i = y * stride + x * bpp;
    return [px[i], px[i + 1], px[i + 2], bpp === 4 ? px[i + 3] : 255];
  };
  return { width, height, at };
}

const isLogo = ([r, g, b]) => Math.abs(r - NAVY[0]) + Math.abs(g - NAVY[1]) + Math.abs(b - NAVY[2]) > 90;

/** The logo's bounding box and furthest pixel from the centre, as fractions of the width. */
function measure({ width, height, at }) {
  let minX = width, maxX = -1, minY = height, maxY = -1, reach = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (isLogo(at(x, y))) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        reach = Math.max(reach, Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2));
      }
  return {
    width: (maxX - minX + 1) / width,
    centerX: (minX + maxX + 1) / 2 / width,
    centerY: (minY + maxY + 1) / 2 / height,
    reach: reach / width,
  };
}

const ICONS = [
  { path: "src/app/apple-icon.png", size: 180, logo: 0.65 },
  { path: "public/icons/v2/icon-192.png", size: 192, logo: 0.65 },
  { path: "public/icons/v2/icon-512.png", size: 512, logo: 0.65 },
  { path: "public/icons/v2/maskable-192.png", size: 192, logo: 0.6, maskable: true },
  { path: "public/icons/v2/maskable-512.png", size: 512, logo: 0.6, maskable: true },
];

for (const icon of ICONS) {
  test(`${icon.path}: full-bleed navy square, logo ~${icon.logo * 100}% wide and centred`, () => {
    const png = readPng(icon.path);
    assert.equal(png.width, icon.size);
    assert.equal(png.height, icon.size);

    // Corners and edges: solid navy, fully opaque (no rounding, border or padding tile).
    const last = icon.size - 1;
    for (let i = 0; i < icon.size; i++)
      for (const [x, y] of [[i, 0], [i, last], [0, i], [last, i]]) {
        const [r, g, b, a] = png.at(x, y);
        assert.equal(a, 255, `${icon.path} (${x},${y}) is opaque`);
        assert.ok(
          Math.abs(r - NAVY[0]) + Math.abs(g - NAVY[1]) + Math.abs(b - NAVY[2]) <= 3,
          `${icon.path} (${x},${y}) is navy, got ${[r, g, b]}`,
        );
      }

    const m = measure(png);
    assert.ok(Math.abs(m.width - icon.logo) <= 0.02, `${icon.path}: logo is ${(m.width * 100).toFixed(1)}% wide`);
    assert.ok(Math.abs(m.centerX - 0.5) <= 0.01 && Math.abs(m.centerY - 0.5) <= 0.01, `${icon.path}: logo is centred`);
    // Maskable: inside the centre circle of 80% diameter that Android always shows.
    if (icon.maskable) assert.ok(m.reach <= 0.4, `${icon.path}: logo reaches ${(m.reach * 100).toFixed(1)}% from the centre`);
  });
}

test("the manifest, service worker and offline page use the new (v2) icon files", () => {
  const manifest = readFileSync("src/app/manifest.ts", "utf8");
  for (const f of ["icon-192", "icon-512", "maskable-192", "maskable-512"]) assert.match(manifest, new RegExp(`/icons/v2/${f}\\.png`));
  assert.doesNotMatch(manifest, /"\/icons\/(icon|maskable)-/);
  assert.match(readFileSync("public/sw.js", "utf8"), /\/icons\/v2\/icon-192\.png/);
  assert.match(readFileSync("public/offline.html", "utf8"), /\/icons\/v2\/icon-192\.png/);
});
