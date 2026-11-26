import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { PageHeader, Skeleton } from "@/components/ui/Primitives";
import { getOfficer } from "@/lib/auth";
import { getEventLists } from "@/lib/events";
import { formatDate } from "@/lib/time";
import { type FlyerEvent, FlyerTool } from "./FlyerTool";

export const metadata: Metadata = { title: "Flyer QR" };

export default function FlyerPage() {
  return (
    <div>
      <PageHeader
        label="Officer portal"
        title="Flyer QR"
        description="Make a QR code for a flyer or poster: to our Join page, to one event's page, or to a short link. A label tells us which flyer people scanned."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Flyer />
      </Suspense>
    </div>
  );
}

async function Flyer() {
  if (!(await getOfficer("/officer/flyer"))) return <OfficersOnly />;
  // The site's public URL (follows a custom domain when NEXT_PUBLIC_SITE_URL changes).
  const host = (await headers()).get("host");
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `https://${host}`).replace(/\/$/, "");
  // Events that haven't ended yet (the same "Upcoming" list as /events), soonest first.
  const { upcoming } = await getEventLists();
  const events: FlyerEvent[] = upcoming.map((e) => ({
    id: e.id,
    title: e.title,
    date: formatDate(e.starts_at),
    live: e.status === "live",
  }));
  return <FlyerTool baseUrl={base} events={events} />;
}
