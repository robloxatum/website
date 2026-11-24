/**
 * Artwork manifest. Every image is optional: while a value is null the site
 * draws an SVG fallback. To swap in real art, put the file in public/art/
 * (see design/ASSETS.md for sizes) and set its path here, e.g. "/art/hero.webp".
 *
 * The club mascot (public/art/mascot.png) is always used; see <Mascot />.
 */
import type { EventCategory } from "@/lib/types";

export const art: {
  hero: string | null;
  joinHero: string | null;
  emptyState: string | null;
  featured: string | null;
  covers: Record<EventCategory, string | null>;
} = {
  hero: null,
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
