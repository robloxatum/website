// Default event covers (public/art/covers). No runtime imports: the unit tests
// run this file directly with Node.

/** One image in public/art/covers, with its pixel size (read at build time). */
export type DefaultCover = { file: string; width: number; height: number };

/**
 * The covers folder as next.config.ts found it at build time (inlined there via
 * `env`), so adding a cover is just dropping a file in the folder.
 */
export const DEFAULT_COVERS: DefaultCover[] = parseCovers(process.env.DEFAULT_COVERS);

function parseCovers(json: string | undefined): DefaultCover[] {
  try {
    const list = JSON.parse(json ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function defaultCoverSrc(cover: DefaultCover) {
  return `/art/covers/${encodeURIComponent(cover.file)}`;
}

/** FNV-1a: a small, stable hash, so an event's cover never changes between requests or deploys. */
export function hashId(id: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The cover an event gets on its own (when it isn't next to another event in a list). */
export function preferredCover(id: string, count: number) {
  return count > 0 ? hashId(id) % count : -1;
}

/**
 * Default cover index for each event in a list, in list order. Each event gets
 * its preferred cover unless the card before it already shows that image; then
 * it steps forward to the next image that differs from its neighbours. The
 * result depends only on the IDs and their order, so it is the same on every
 * request. A null ID is an event with its own uploaded cover: it gets -1 and
 * doesn't count as a neighbour. Returns -1 for every event when there are no covers.
 */
export function assignDefaultCovers(ids: readonly (string | null)[], count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (id === null) {
      out.push(-1);
      continue;
    }
    const preferred = preferredCover(id, count);
    const prev = i > 0 ? out[i - 1] : -1;
    // Also steer clear of the next event's own pick, so one shift doesn't force another.
    const nextId = i + 1 < ids.length ? ids[i + 1] : null;
    const next = nextId !== null ? preferredCover(nextId, count) : -1;
    let pick = preferred;
    if (count > 1 && pick === prev) {
      pick = -1;
      for (let step = 1; step < count && pick === -1; step++) {
        const c = (preferred + step) % count;
        if (c !== prev && (c !== next || count < 3)) pick = c;
      }
      if (pick === -1) pick = (preferred + 1) % count;
    }
    out.push(pick);
  }
  return out;
}
