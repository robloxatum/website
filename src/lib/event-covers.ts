import { DEFAULT_COVERS, assignDefaultCovers, defaultCoverSrc, preferredCover } from "./covers";
import { flyerUrl } from "./flyers";
import type { EventCoverImage, PublicEvent } from "./types";

type CoverFields = Pick<PublicEvent, "id" | "title" | "cover_path" | "cover_width" | "cover_height">;

/** An officer-uploaded cover (in the event-flyers bucket under covers/), or null. */
export function uploadedCoverOf(e: Pick<PublicEvent, "cover_path" | "cover_width" | "cover_height">) {
  return e.cover_path && e.cover_width && e.cover_height
    ? { path: e.cover_path, width: e.cover_width, height: e.cover_height }
    : null;
}

/**
 * The cover to show for an event: its uploaded cover, else a default from
 * public/art/covers (by `defaultIndex`, or the event's own pick by ID).
 * Uploaded covers are described for screen readers; defaults are decorative.
 */
export function coverFor(e: CoverFields, defaultIndex = preferredCover(e.id, DEFAULT_COVERS.length)): EventCoverImage | null {
  const uploaded = uploadedCoverOf(e);
  if (uploaded) {
    return { src: flyerUrl(uploaded.path), width: uploaded.width, height: uploaded.height, alt: `Cover image for ${e.title}` };
  }
  const d = DEFAULT_COVERS[defaultIndex];
  return d ? { src: defaultCoverSrc(d), width: d.width, height: d.height, alt: "" } : null;
}

/** Adds each event's cover, avoiding the same default image on two cards in a row. */
export function withCovers<T extends CoverFields>(events: T[]): (T & { cover: EventCoverImage | null })[] {
  const picks = assignDefaultCovers(
    events.map((e) => (uploadedCoverOf(e) ? null : e.id)),
    DEFAULT_COVERS.length,
  );
  return events.map((e, i) => ({ ...e, cover: coverFor(e, picks[i]) }));
}
