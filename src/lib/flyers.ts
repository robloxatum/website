import { supabaseUrl } from "@/lib/supabase/env";

/** Public Storage bucket for event flyers and uploaded covers (event_flyers and event_covers migrations). */
export const FLYER_BUCKET = "event-flyers";
export const FLYER_MAX_BYTES = 5 * 1024 * 1024;
export const FLYER_MAX_DIMENSION = 20000;
/** Allowed upload types → file extension used in the object name. */
export const FLYER_TYPES: Record<string, "png" | "jpg"> = { "image/png": "png", "image/jpeg": "jpg" };
/** Object names are "<random uuid>.png|jpg" at the bucket root (same rule as the DB and Storage policies). */
export const FLYER_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$/;

export type Flyer = { path: string; width: number; height: number };

export function flyerUrl(path: string) {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${FLYER_BUCKET}/${path}`;
}

export function flyerOf(e: { flyer_path: string | null; flyer_width: number | null; flyer_height: number | null }): Flyer | null {
  return e.flyer_path && e.flyer_width && e.flyer_height
    ? { path: e.flyer_path, width: e.flyer_width, height: e.flyer_height }
    : null;
}

/** Friendly check before uploading (the bucket enforces the same limits). */
export function flyerFileError(file: File) {
  if (!FLYER_TYPES[file.type]) return "The flyer must be a PNG or JPG image.";
  if (file.size > FLYER_MAX_BYTES) return `The flyer is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`;
  return null;
}

// Uploaded event covers: same bucket, under covers/ (event_covers migration).
export const COVER_MIN_WIDTH = 1200;
export const COVER_MIN_HEIGHT = 600;
/** Allowed upload types → file extension used in the object name. */
export const COVER_TYPES: Record<string, "png" | "jpg" | "webp"> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
/** Object names are "covers/<random uuid>.png|jpg|webp" (same rule as the DB and Storage policies). */
export const COVER_PATH = /^covers\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

export type Cover = Flyer;

/** Friendly check of the file before reading its size (the bucket enforces type and 5 MB too). */
export function coverFileError(file: File) {
  if (!COVER_TYPES[file.type]) return "The cover must be a JPG, PNG or WebP image.";
  if (file.size > FLYER_MAX_BYTES) return `The cover is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`;
  return null;
}

/** Friendly check of the cover's pixel size (the database enforces the minimum too). */
export function coverSizeError(width: number, height: number) {
  if (width < COVER_MIN_WIDTH || height < COVER_MIN_HEIGHT) {
    return `The cover is ${width} × ${height}. It needs to be at least ${COVER_MIN_WIDTH} × ${COVER_MIN_HEIGHT} (1600 × 800 is best).`;
  }
  if (width > FLYER_MAX_DIMENSION || height > FLYER_MAX_DIMENSION) return "That image is too large (20,000 px max per side).";
  return null;
}
