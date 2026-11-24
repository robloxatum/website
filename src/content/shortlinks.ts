/**
 * Expiring short links for printed flyers: /go/<slug>.
 *
 * Before `expiresAt` a scan goes to `target`; from then on it goes to
 * `afterExpiry`. Both are paths on this site. Put ?src=<label> on /join
 * targets so Vercel Analytics can tell flyers apart (/join/src/<label>).
 * Unknown slugs go to the homepage. Redirects are temporary (307, no-store),
 * so a link can be retargeted or extended later by editing this file.
 *
 * Never reuse a slug that has been printed for something else.
 */
export type ShortLink = {
  /** The part after /go/. Lowercase letters, numbers, - and _. */
  slug: string;
  /** Site path used until expiresAt, e.g. "/join?src=flyer-gameover". */
  target: string;
  /** ISO 8601 with a UTC offset, e.g. "2026-12-11T00:00:00-05:00" (midnight Eastern). */
  expiresAt: string;
  /** Site path used from expiresAt on. */
  afterExpiry: string;
};

export const shortlinks: readonly ShortLink[] = [
  {
    slug: "gameover",
    target: "/join?src=flyer-gameover",
    expiresAt: "2026-12-11T00:00:00-05:00",
    afterExpiry: "/",
  },
];
