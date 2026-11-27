/**
 * Removes metadata (EXIF with GPS and camera details, XMP, IPTC, comments,
 * text chunks) from a JPEG, PNG or WebP file before it's uploaded to the
 * public flyer bucket (security audit 3, L-1). The image data itself is
 * copied byte for byte, so there's no re-encoding and no quality loss.
 *
 * Kept: what's needed to show the image the same way: JPEG JFIF, ICC colour
 * profile and Adobe segments; PNG's colour and transparency chunks; WebP's
 * ICC profile and animation. A JPEG's EXIF rotation is kept as a new minimal
 * EXIF block holding only that tag, so phone photos stay upright.
 *
 * Returns null when the file isn't a well-formed image of that type; the
 * caller refuses the upload rather than publishing the metadata.
 */
export function stripImageMetadata(bytes: Uint8Array, type: string): Uint8Array | null {
  try {
    if (type === "image/jpeg") return stripJpeg(bytes);
    if (type === "image/png") return stripPng(bytes);
    if (type === "image/webp") return stripWebp(bytes);
  } catch {
    // Out-of-range reads on truncated files.
  }
  return null;
}

/** The image type from the file's first bytes (a file's own `type` comes from its name). */
export function sniffImageType(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (PNG_SIGNATURE.every((v, k) => b[k] === v)) return "image/png";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "image/webp";
  return null;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const ascii = (b: Uint8Array, at: number, s: string) => [...s].every((c, i) => b[at + i] === c.charCodeAt(0));

// ---------------------------------------------------------------- JPEG

function stripJpeg(b: Uint8Array): Uint8Array | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  const out: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    let m = b[i + 1];
    while (m === 0xff) m = b[++i + 1]; // fill bytes
    if (m === undefined) return null;
    if (m === 0xd9) return concat([...out, b.subarray(i, i + 2)]); // EOI
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      out.push(b.subarray(i, i + 2)); // no length
      i += 2;
      continue;
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (!(len >= 2) || i + 2 + len > b.length) return null;
    const seg = b.subarray(i, i + 2 + len);
    const data = i + 4;
    if (m === 0xda) {
      // Start of scan: the header, then entropy-coded data up to the next
      // marker (0xFF followed by anything but a stuffed 0x00 or a restart).
      // Progressive files have several scans; anything after the end-of-image
      // marker (other pictures some phones append, with their own EXIF) is dropped.
      let j = i + 2 + len;
      while (j + 1 < b.length && !(b[j] === 0xff && b[j + 1] !== 0x00 && !(b[j + 1] >= 0xd0 && b[j + 1] <= 0xd7))) j++;
      if (j + 1 >= b.length) return null;
      out.push(b.subarray(i, j));
      i = j;
      continue;
    }
    const keep =
      (m < 0xe0 || m > 0xef) && m !== 0xfe // not APPn or COM: tables, frame header
        ? true
        : m === 0xe0 ? ascii(b, data, "JFIF\0") || ascii(b, data, "JFXX\0")
        : m === 0xe2 ? ascii(b, data, "ICC_PROFILE\0")
        : m === 0xee ? ascii(b, data, "Adobe")
        : false;
    if (keep) out.push(seg);
    else if (m === 0xe1 && ascii(b, data, "Exif\0\0")) {
      const o = exifOrientation(b.subarray(data + 6, i + 2 + len));
      if (o && o !== 1) out.push(orientationOnlyExif(o));
    }
    i += 2 + len;
  }
  return null; // no image data
}

/** The Orientation tag (0x0112) in IFD0 of a TIFF block, if any. */
function exifOrientation(t: Uint8Array): number | null {
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return null;
  const u16 = (at: number) => (le ? t[at] | (t[at + 1] << 8) : (t[at] << 8) | t[at + 1]);
  const u32 = (at: number) => (le ? u16(at) + u16(at + 2) * 0x10000 : u16(at) * 0x10000 + u16(at + 2));
  if (u16(2) !== 42) return null;
  const ifd = u32(4);
  const n = u16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > t.length) return null;
    if (u16(e) === 0x0112 && u16(e + 2) === 3) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : null;
    }
  }
  return null;
}

/** An APP1 EXIF segment holding only IFD0 with the Orientation tag (big-endian TIFF). */
function orientationOnlyExif(o: number): Uint8Array {
  // prettier-ignore
  return new Uint8Array([
    0xff, 0xe1, 0x00, 0x22,                         // APP1, length 34
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,             // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // "MM", 42, IFD0 at 8
    0x00, 0x01,                                     // 1 entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, // Orientation, SHORT, count 1
    0x00, o, 0x00, 0x00,                            // value
    0x00, 0x00, 0x00, 0x00,                         // no next IFD
  ]);
}

// ---------------------------------------------------------------- PNG

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Chunks needed to show the image (incl. colour, transparency and APNG); everything else is dropped. */
const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "cICP", "mDCV", "cLLI", "acTL", "fcTL", "fdAT"]);

function stripPng(b: Uint8Array): Uint8Array | null {
  if (!PNG_SIGNATURE.every((v, k) => b[k] === v)) return null;
  const out: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
    const end = i + 12 + len;
    if (end > b.length) return null;
    const name = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    if (PNG_KEEP.has(name)) out.push(b.subarray(i, end)); // copied with its CRC
    i = end;
    if (name === "IEND") return concat(out);
  }
  return null; // no IEND
}

// ---------------------------------------------------------------- WebP

function stripWebp(b: Uint8Array): Uint8Array | null {
  if (!ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  const riffEnd = 8 + (b[4] | (b[5] << 8) | (b[6] << 16) | ((b[7] << 24) >>> 0));
  if (riffEnd > b.length) return null;
  const out: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= riffEnd) {
    const len = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | ((b[i + 7] << 24) >>> 0);
    const end = i + 8 + len + (len & 1); // chunks are padded to an even size
    if (end > riffEnd) return null;
    const name = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
    if (name === "VP8X") {
      const chunk = b.slice(i, end);
      chunk[8] &= ~0x0c; // clear the EXIF (0x08) and XMP (0x04) flags
      out.push(chunk);
    } else if (name !== "EXIF" && name !== "XMP ") out.push(b.subarray(i, end));
    i = end;
  }
  if (!out.length) return null;
  const body = concat(out);
  const size = body.length + 4;
  const header = new Uint8Array([0x52, 0x49, 0x46, 0x46, size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >>> 24) & 0xff, 0x57, 0x45, 0x42, 0x50]);
  return concat([header, body]);
}
