/**
 * Officer-verified highlights. NOT rendered anywhere right now (the site talks
 * to U-M students, not investors); kept for possible future use. If you ever
 * render them, update `lastVerified` (YYYY-MM-DD) and never add an unverified number.
 */
export const highlights = {
  lastVerified: null as string | null,
  items: [
    { value: "100+", label: "members in our first 3 weeks" },
    { value: "4,100+", label: "Instagram followers" },
    { value: "72-hour", label: "Game Jam with Roblox" },
  ],
} as const;

/** The featured story on the home page. */
export const featured = {
  kicker: "Featured",
  title: "72-hour Game Jam with Roblox",
  body: "Teams spent three days building games together, start to finish. Jams are the best way to learn fast and make something real.",
} as const;
