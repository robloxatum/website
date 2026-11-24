import "server-only";
import { AtSign, CalendarCheck, QrCode, Trophy, Users } from "lucide-react";
import type { Stat } from "@/components/ui/Blocks";
import { highlights } from "@/content/highlights";
import { getPublicStats } from "./events";

const highlightIcons = [Users, AtSign, Trophy];

/**
 * Stats for the public stats bar: the officer-verified highlights plus live
 * database totals that have reached the public threshold. Nothing is invented.
 * The live member count replaces the "100+ members" highlight only once it is
 * at least 100 (so two different member numbers never appear side by side).
 */
export async function getStats(): Promise<Stat[]> {
  const live = await getPublicStats();
  const stats: Stat[] = highlights.items.map((h, i) => ({ value: h.value, label: h.label, icon: highlightIcons[i] ?? Trophy }));

  if (live.members !== null && live.members >= 100) {
    stats[0] = { value: live.members.toLocaleString("en-US"), label: "members", icon: Users };
  }
  if (live.total_checkins !== null) {
    stats.push({ value: live.total_checkins.toLocaleString("en-US"), label: "event check-ins", icon: QrCode });
  } else if (live.events_held !== null) {
    stats.push({ value: String(live.events_held), label: "events held", icon: CalendarCheck });
  }
  return stats.slice(0, 4);
}
