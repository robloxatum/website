import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { PageTitle, SkeletonBlock } from "@/components/Notice";
import { getOfficer } from "@/lib/auth";
import { formatDate, formatTimeRange, hasPassed } from "@/lib/time";
import { CheckinToggle } from "./_components/CheckinControls";
import { OfficerTabs } from "./_components/OfficerTabs";
import { getOfficerEvents } from "./data";

export const metadata: Metadata = { title: "Officer dashboard" };

export default function OfficerPage() {
  return (
    <div>
      <PageTitle kicker="Officers">Dashboard</PageTitle>
      <Suspense fallback={<SkeletonBlock className="h-96" />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function Dashboard() {
  if (!(await getOfficer("/officer"))) return <OfficersOnly />;
  const events = await getOfficerEvents();
  const upcoming = events.filter((e) => !hasPassed(e.ends_at)).reverse();
  const past = events.filter((e) => hasPassed(e.ends_at));

  return (
    <div>
      <OfficerTabs active="events" />
      <Link href="/officer/events/new" className="btn btn-maize mb-6">
        + New event
      </Link>

      <EventList title="Upcoming & live" events={upcoming} empty="No upcoming events. Create one!" />
      <EventList title="Past" events={past} empty="No past events yet." />
    </div>
  );
}

function EventList({
  title,
  events,
  empty,
}: {
  title: string;
  events: Awaited<ReturnType<typeof getOfficerEvents>>;
  empty: string;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xl">{title}</h2>
      {events.length === 0 ? (
        <p className="block-card p-4">{empty}</p>
      ) : (
        <ul className="space-y-4">
          {events.map((e) => (
            <li key={e.id} className="block-card space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/officer/events/${e.id}`} className="font-display text-lg leading-tight hover:underline">
                    {e.title}
                  </Link>
                  <p className="text-sm text-blue/70">
                    {formatDate(e.starts_at)} · {formatTimeRange(e.starts_at, e.ends_at)}
                  </p>
                </div>
                <span className="tag bg-maize">{e.attendance[0]?.count ?? 0} checked in</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <CheckinToggle
                  key={`${e.checkin_open}-${e.checkin_reopened}-${e.ends_at}`}
                  eventId={e.id}
                  initial={{ checkin_open: e.checkin_open, checkin_reopened: e.checkin_reopened, ends_at: e.ends_at }}
                />
                <Link href={`/officer/events/${e.id}/present`} className="btn btn-blue btn-sm">
                  Present
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
