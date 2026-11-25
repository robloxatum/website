import { ArrowRight, CalendarDays, DatabaseBackup, History, Plus, ScanLine, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { CornerCubes } from "@/components/art/Cubes";
import { EmptyState, Panel } from "@/components/ui/Blocks";
import { PageHeader } from "@/components/ui/Primitives";
import { button, card } from "@/components/ui/styles";
import type { OfficerEventWithCount } from "../data";
import { OfficerEventCard, PastEventRow } from "./OfficerEventCards";

function SummaryCard({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className={`relative overflow-hidden ${card} flex items-center gap-4 p-5`}>
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-bg-2">
        <Icon aria-hidden="true" className="size-6 text-maize" />
      </span>
      <div>
        <p className="font-display text-3xl leading-none font-extrabold text-fg tabular-nums">{value.toLocaleString("en-US")}</p>
        <p className="mt-1 text-sm text-fg-2">{label}</p>
      </div>
      <CornerCubes className="absolute -right-1 -bottom-1 h-14 opacity-60" />
    </div>
  );
}

export function DashboardView({
  upcoming,
  past,
  totals,
}: {
  upcoming: OfficerEventWithCount[];
  past: OfficerEventWithCount[];
  totals: { members: number; checkins: number };
}) {
  return (
    <div className="space-y-8">
      {/* Same header as the other officer pages (title case, same size). */}
      <PageHeader
        label="Officer portal"
        title="Dashboard"
        description="Manage events, check-in and members."
        actions={
          <>
            {/* Plain link: a file download, not a page. */}
            <a
              href="/officer/backup.zip"
              download
              title="Members, events, attendance and RSVPs as CSV files in a .zip"
              className={button({ variant: "secondary", size: "lg" })}
            >
              <DatabaseBackup aria-hidden="true" />
              Download full backup
            </a>
            <Link href="/officer/events/new" className={button({ size: "lg" })}>
              <Plus aria-hidden="true" />
              New Event
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={CalendarDays} value={upcoming.length} label="Upcoming events" />
        <SummaryCard icon={Users} value={totals.members} label="Total members" />
        <SummaryCard icon={ScanLine} value={totals.checkins} label="Total check-ins" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel
          title="Upcoming Events"
          action={
            <Link href="/officer/events" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-fg-2 hover:text-maize">
              View all <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          }
        >
          {upcoming.length ? (
            <div className="space-y-4">
              {upcoming.slice(0, 4).map((e, i) => (
                <OfficerEventCard key={e.id} event={e} highlight={i === 0} />
              ))}
            </div>
          ) : (
            <EmptyState
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
          )}
        </Panel>

        <Panel
          title="Past Events"
          icon={History}
          action={
            past.length > 5 ? (
              <Link href="/officer/events?tab=past" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-fg-2 hover:text-maize">
                History <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            ) : undefined
          }
        >
          {past.length ? (
            <div className="-mx-2 space-y-1">
              {past.slice(0, 5).map((e) => (
                <PastEventRow key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <p className="text-fg-2">Past events and their attendance show up here.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
