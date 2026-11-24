import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { EmptyState } from "@/components/ui/Blocks";
import { PageHeader, Skeleton } from "@/components/ui/Primitives";
import { button, card } from "@/components/ui/styles";
import { Tabs } from "@/components/ui/Tabs";
import { getOfficer } from "@/lib/auth";
import { hasPassed } from "@/lib/time";
import { OfficerEventCard, PastEventRow } from "../_components/OfficerEventCards";
import { getOfficerEvents, type OfficerEventWithCount } from "../data";

export const metadata: Metadata = { title: "Officer events" };

export default function OfficerEventsPage({ searchParams }: PageProps<"/officer/events">) {
  return (
    <div>
      <PageHeader
        label="Officer portal"
        title="Events"
        description="Create, manage and run check-in for events."
        actions={
          <Link href="/officer/events/new" className={button({ size: "lg" })}>
            <Plus aria-hidden="true" />
            New Event
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <EventsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function PastList({ events }: { events: OfficerEventWithCount[] }) {
  if (!events.length) return <p className="text-fg-2">No past events yet.</p>;
  return (
    <div className={`${card} space-y-1 p-2`}>
      {events.map((e) => (
        <PastEventRow key={e.id} event={e} />
      ))}
    </div>
  );
}

async function EventsList({ searchParams }: { searchParams: PageProps<"/officer/events">["searchParams"] }) {
  if (!(await getOfficer("/officer/events"))) return <OfficersOnly />;
  const { tab } = await searchParams;
  const events = await getOfficerEvents();
  const upcoming = events.filter((e) => !hasPassed(e.ends_at)).reverse();
  const past = events.filter((e) => hasPassed(e.ends_at));

  const upcomingContent = upcoming.length ? (
    <div className="grid gap-4 xl:grid-cols-2">
      {upcoming.map((e, i) => (
        <OfficerEventCard key={e.id} event={e} highlight={i === 0} />
      ))}
    </div>
  ) : (
    <div className={card}>
      <EmptyState
        headingLevel="h2"
        title="Ready for the next game night?"
        action={
          <Link href="/officer/events/new" className={button()}>
            <Plus aria-hidden="true" />
            Create an Event
          </Link>
        }
      >
        Create an event to bring the Roblox at UM community together.
      </EmptyState>
    </div>
  );

  return (
    <Tabs
      label="Events"
      initial={tab === "past" || tab === "all" ? tab : "upcoming"}
      tabs={[
        { id: "upcoming", label: "Upcoming", count: upcoming.length, content: upcomingContent },
        { id: "past", label: "Past", count: past.length, content: <PastList events={past} /> },
        {
          id: "all",
          label: "All",
          count: events.length,
          content: (
            <div className="space-y-6">
              {upcoming.length > 0 && upcomingContent}
              <PastList events={past} />
            </div>
          ),
        },
      ]}
    />
  );
}
