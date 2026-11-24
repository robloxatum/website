/**
 * Officer-verified highlights shown on the home page and /join.
 * These are claims, not computed numbers: edit the text here and update
 * `lastVerified` (YYYY-MM-DD) when an officer has checked them.
 * Never add a number here that hasn't been verified.
 */
export const highlights = {
  lastVerified: null as string | null, // e.g. "2026-12-01". Not yet verified.
  items: [
    { value: "100+", label: "members in our first 3 weeks" },
    { value: "4,100+", label: "Instagram followers" },
    { value: "24-hour", label: "Game Jam with Roblox: 22 participants, 6 games" },
  ],
} as const;

/** The featured story shown when there's no upcoming event to highlight. */
export const featured = {
  kicker: "Featured",
  title: "24-hour Game Jam with Roblox",
  body: "22 participants built 6 games in a single day. Jams are our favorite way to learn fast and ship something real.",
} as const;

/** Live database totals are only shown publicly once they reach this. */
export const MIN_PUBLIC_COUNT = 10;
