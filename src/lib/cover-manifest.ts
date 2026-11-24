// Build-time list of the default event covers in public/art/covers, with each
// image's real pixel size. Used by next.config.ts (and the unit tests), so it
// may only import Node built-ins.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DefaultCover } from "./covers.ts";

const IMAGE_FILE = /\.(webp|png|jpe?g)$/i;

/** Every image in `dir`, sorted by name (so the order, and each event's cover, is stable). */
export function readCoverManifest(dir: string): DefaultCover[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => IMAGE_FILE.test(f) && !f.startsWith("."));
  } catch {
    return [];
  }
  return files.sort().flatMap((file) => {
    const size = imageSize(readFileSync(join(dir, file)));
    if (!size) {
      console.warn(`[covers] Skipping ${file}: not a readable WebP, PNG or JPEG.`);
      return [];
    }
    return [{ file, ...size }];
  });
}

/** Pixel size from a WebP, PNG or JPEG header, or null. */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  // PNG: IHDR is always the first chunk.
  if (buf.length >= 24 && buf.toString("latin1", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // WebP: RIFF....WEBP then a VP8 / VP8L / VP8X chunk.
  if (buf.length >= 30 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    const chunk = buf.toString("latin1", 12, 16);
    if (chunk === "VP8X") {
      return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
    if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    if (chunk === "VP8 ") {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    return null;
  }
  // JPEG: walk the markers to the first start-of-frame.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}
