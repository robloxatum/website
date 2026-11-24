/**
 * Links shown on /links. Fill in the URLs; entries with an empty href are hidden.
 */
export type ClubLink = { label: string; href: string; blurb: string; color: string };

export const clubLinks: ClubLink[] = [
  { label: "Discord", href: "", blurb: "Chat, find teammates, get event pings", color: "bg-[#5865F2] text-white" },
  { label: "Instagram", href: "", blurb: "Photos and event announcements", color: "bg-[#E1306C] text-white" },
  { label: "Maize Pages", href: "", blurb: "Our official UM student org page", color: "bg-maize text-blue" },
  { label: "Roblox Group", href: "", blurb: "Join the club group in Roblox", color: "bg-white text-blue" },
  { label: "Email", href: "", blurb: "Questions? Reach the officers", color: "bg-sky text-blue" },
];
