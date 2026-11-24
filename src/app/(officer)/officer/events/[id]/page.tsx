import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { Skeleton } from "@/components/ui/Primitives";
import { getOfficer } from "@/lib/auth";
import { isUuid } from "@/lib/events";
import { headshotsFor } from "@/lib/roblox";
import { ManageEventView } from "../../_components/ManageEventView";
import { getAttendees, getOfficerEvent } from "../../data";

export const metadata: Metadata = { title: "Manage event" };

export default function ManageEventPage(props: PageProps<"/officer/events/[id]">) {
  return (
    <div>
      <Link href="/officer/events" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-fg-2 hover:text-maize">
        <ArrowLeft aria-hidden="true" className="size-4" /> Events
      </Link>
      <Suspense fallback={<Skeleton className="mt-4 h-96" />}>
        <ManageEvent {...props} />
      </Suspense>
    </div>
  );
}

async function ManageEvent({ params, searchParams }: PageProps<"/officer/events/[id]">) {
  const { id } = await params;
  const { saved } = await searchParams;
  if (!(await getOfficer(`/officer/events/${id}`))) return <OfficersOnly />;
  if (!isUuid(id)) notFound();

  const [data, attendees] = await Promise.all([getOfficerEvent(id), getAttendees(id)]);
  if (!data) notFound();
  // Roblox headshots (cached ~1 hour; null → initial-letter icon).
  const avatars = await headshotsFor(attendees.map((a) => a.profiles ?? {}));
  return (
    <ManageEventView
      event={data.event}
      code={data.code}
      attendees={attendees.map((a, i) => ({ ...a, avatar: avatars[i] }))}
      saved={!!saved}
    />
  );
}
