import type { Metadata } from "next";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { Skeleton } from "@/components/ui/Primitives";
import { getOfficer } from "@/lib/auth";
import { hasPassed } from "@/lib/time";
import { DashboardView } from "./_components/DashboardView";
import { getOfficerEvents, getOfficerTotals } from "./data";

export const metadata: Metadata = { title: "Officer dashboard" };

export default function OfficerPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[36rem]" />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const officer = await getOfficer("/officer");
  if (!officer) return <OfficersOnly />;
  const [events, totals] = await Promise.all([getOfficerEvents(), getOfficerTotals()]);
  const upcoming = events.filter((e) => !hasPassed(e.ends_at)).reverse(); // soonest first
  const past = events.filter((e) => hasPassed(e.ends_at));
  return <DashboardView upcoming={upcoming} past={past} totals={totals} />;
}
