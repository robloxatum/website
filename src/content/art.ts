/**
 * Artwork manifest. Every image is optional: while a value is null the site
 * draws an SVG fallback. To swap in real art, put the file in public/art/
 * (see design/ASSETS.md for sizes) and set its path here, e.g. "/art/hero.webp".
 *
 * The club mascot (public/art/mascot.png) is always used; see <Mascot />.
 */
import type { StaticImageData } from "next/image";
import type { EventCategory } from "@/lib/types";
import heroDusk from "../../public/art/hero-dusk.png";

export const art: {
  // Static import: Next reads the size and makes the blur placeholder at build time.
  hero: StaticImageData | null;
  joinHero: string | null;
  emptyState: string | null;
  featured: string | null;
  covers: Record<EventCategory, string | null>;
} = {
  // Dusk scene: empty navy sky on the left third (text goes there), friends and
  // the tower on the right. (hero-sketch-blueprint.png, hero-sketch.png and
  // hero-campus.png are earlier versions, kept but unused.)
  hero: heroDusk,
  joinHero: null,
  emptyState: null,
  featured: null,
  covers: {
    game_night: null,
    workshop: null,
    game_jam: null,
    social: null,
    meeting: null,
    partner: null,
  },
};
