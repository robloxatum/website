import { Code2, Gamepad2, Handshake, Megaphone, Trophy, Users, type LucideIcon } from "lucide-react";
import type { EventCategory } from "./types";

export type CategoryInfo = {
  label: string;
  icon: LucideIcon;
  /** Two-stop gradient used by the fallback cover art. */
  from: string;
  to: string;
};

export const CATEGORIES: Record<EventCategory, CategoryInfo> = {
  game_night: { label: "Game Night", icon: Gamepad2, from: "#2b1f6b", to: "#c2410c" },
  workshop: { label: "Workshop", icon: Code2, from: "#0b3a6b", to: "#0e7490" },
  game_jam: { label: "Game Jam", icon: Trophy, from: "#3b1a5a", to: "#7c3aed" },
  social: { label: "Social", icon: Users, from: "#0f3d3a", to: "#15803d" },
  meeting: { label: "Meeting", icon: Megaphone, from: "#102c46", to: "#1d4f7c" },
  partner: { label: "Partner Event", icon: Handshake, from: "#4a3500", to: "#b8860b" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as EventCategory[];

export function categoryInfo(category: string | null | undefined): CategoryInfo {
  return CATEGORIES[(category as EventCategory) ?? "meeting"] ?? CATEGORIES.meeting;
}
