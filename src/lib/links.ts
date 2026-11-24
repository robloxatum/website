/**
 * Links shown on /links. Fill in the URLs; entries with an empty href are hidden.
 */
export type ClubLinkKey = "discord" | "instagram" | "maizepages" | "roblox" | "email";
export type ClubLink = { key: ClubLinkKey; label: string; href: string; blurb: string; color: string };

export const clubLinks: ClubLink[] = [
  { key: "discord", label: "Discord", href: "", blurb: "Chat, find teammates, get event pings", color: "bg-[#5865F2] text-white" },
  { key: "instagram", label: "Instagram", href: "", blurb: "Photos and event announcements", color: "bg-[#E1306C] text-white" },
  { key: "maizepages", label: "Maize Pages", href: "", blurb: "Our official UM student org page", color: "bg-maize text-blue" },
  { key: "roblox", label: "Roblox Group", href: "", blurb: "Join the club group in Roblox", color: "bg-white text-blue" },
  { key: "email", label: "Email", href: "mailto:robloxatumich@gmail.com", blurb: "Questions? Reach the officers", color: "bg-sky text-blue" },
];

export function clubLink(key: ClubLinkKey): ClubLink | null {
  const link = clubLinks.find((l) => l.key === key);
  return link?.href ? link : null;
}
