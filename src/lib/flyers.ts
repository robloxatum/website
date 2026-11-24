import { supabaseUrl } from "@/lib/supabase/env";

/** Public Storage bucket for event flyers (see the event_flyers migration). */
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
