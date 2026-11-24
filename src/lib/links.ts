/**
 * Community links, in the order they appear everywhere (/links, /join,
 * "You're in!", footer). Entries with an empty href are hidden.
 */
export type ClubLinkKey = "instagram" | "groupme" | "discord" | "roblox" | "linkedin" | "maizepages" | "email";
export type ClubLink = { key: ClubLinkKey; label: string; href: string; blurb: string };

export const clubLinks: ClubLink[] = [
  { key: "instagram", label: "Instagram", href: "https://www.instagram.com/michiganrobloxclub", blurb: "Photos and event announcements" },
  { key: "groupme", label: "GroupMe", href: "https://groupme.com/join_group/110761275/29bjlQWA", blurb: "Quick updates and chat" },
  { key: "discord", label: "Discord", href: "https://discord.gg/83Xtc9TJtA", blurb: "Hang out, find teammates, play together" },
  { key: "roblox", label: "Roblox Group", href: "https://www.roblox.com/share/g/498559567", blurb: "Join the club group on Roblox" },
  { key: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/company/roblox-at-um", blurb: "Club news and opportunities" },
  { key: "maizepages", label: "Maize Pages", href: "https://maizepages.umich.edu/organization/roblox-at-um", blurb: "Our official U-M student org page" },
  { key: "email", label: "Email", href: "mailto:robloxatumich@gmail.com", blurb: "Questions? Reach the officers" },
];

/** The six community links, in order (everything except email). */
export const COMMUNITY_KEYS: ClubLinkKey[] = ["instagram", "groupme", "discord", "roblox", "linkedin", "maizepages"];

/** Not part of the link list: used where they fit (Events page, empty states, "You're in!"). */
export const CALENDAR_URL =
  "https://calendar.google.com/calendar/u/0?cid=Y180ZWU5ZGJjYTgyZjcyYWFlMTBlY2I0YjE0M2Y2ZWVmOWJhYTJjOGRmZjAwYjE0ZjhjYWM3NmU2YTI2YTIxNDQyQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20";
export const MAILING_LIST_URL = "https://forms.gle/juqzwbg7mfaTZuib6";

export function clubLink(key: ClubLinkKey): ClubLink | null {
  const link = clubLinks.find((l) => l.key === key);
  return link?.href ? link : null;
}
