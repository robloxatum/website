import { CalendarDays, MapPin, MonitorPlay, Users } from "lucide-react";
import Link from "next/link";
import { EventCover } from "@/components/art/Art";
import { CategoryBadge, ProgressBar, StatusPill } from "@/components/ui/Primitives";
import { button, card } from "@/components/ui/styles";
import { coverFor } from "@/lib/event-covers";
import { eventStatus } from "@/lib/events";
import { formatDate, formatTimeRange } from "@/lib/time";
import type { OfficerEventWithCount } from "../data";
import { CheckinToggle } from "./CheckinControls";

export function attendanceCount(e: OfficerEventWithCount) {
  return e.attendance[0]?.count ?? 0;
}

/** "78 / 132 checked in" with a bar when a capacity is set; otherwise just the count. */
export function CapacityMeter({ count, capacity }: { count: number; capacity: number | null }) {
  if (!capacity) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-fg-2">
        <Users aria-hidden="true" className="size-4 text-fg-3" />
        <span className="font-semibold text-fg tabular-nums">{count}</span> checked in
      </p>
    );
  }
  const pct = Math.round((count / capacity) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm text-fg-2">
        <span className="inline-flex items-center gap-1.5">
          <Users aria-hidden="true" className="size-4 text-fg-3" />
          <span className="font-semibold text-fg tabular-nums">{count}</span> / {capacity} checked in
        </span>
        <span className="font-semibold text-fg tabular-nums">{pct}%</span>
      </div>
      <ProgressBar value={Math.min(count, capacity)} max={capacity} label={`${count} of ${capacity} checked in`} />
    </div>
  );
}

/** Upcoming / live event with check-in controls (dashboard and events list). */
export function OfficerEventCard({ event, highlight = false }: { event: OfficerEventWithCount; highlight?: boolean }) {
  const status = eventStatus(event);
  return (
    <article className={`${card} p-4 ${highlight ? "border-maize/40" : ""}`}>
      <div className="flex gap-4">
        <EventCover category={event.category} cover={coverFor(event)} className="aspect-[2/1] w-24 shrink-0 self-start rounded-xl sm:w-32" sizes="128px" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {highlight && <span className="rounded-md bg-maize px-2 py-0.5 text-[11px] font-bold tracking-wider text-navy uppercase">Next up</span>}
            <CategoryBadge category={event.category} className={highlight ? "bg-elevated! text-fg!" : ""} />
            <StatusPill status={status} />
          </div>
          <h3 className="mt-1.5 text-lg leading-snug">
            <Link href={`/officer/events/${event.id}`} className="text-fg hover:text-maize">
              {event.title}
            </Link>
          </h3>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4 text-fg-3" />
              {formatDate(event.starts_at)} · {formatTimeRange(event.starts_at, event.ends_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden="true" className="size-4 text-fg-3" />
              {event.location || "Location TBA"}
            </span>
          </p>
        </div>
      </div>
      <div className="mt-4 border-t border-line/50 pt-4">
        <CapacityMeter count={attendanceCount(event)} capacity={event.capacity} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <CheckinToggle
          key={`${event.checkin_open}-${event.checkin_reopened}-${event.ends_at}`}
          eventId={event.id}
          initial={{ checkin_open: event.checkin_open, checkin_reopened: event.checkin_reopened, ends_at: event.ends_at }}
        />
        <Link href={`/officer/events/${event.id}/present`} className={button({ variant: "secondary", size: "sm" })}>
          <MonitorPlay aria-hidden="true" />
          Present
        </Link>
      </div>
    </article>
  );
}

/** Compact row for past events. */
export function PastEventRow({ event }: { event: OfficerEventWithCount }) {
  return (
    <Link href={`/officer/events/${event.id}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.04]">
      <EventCover category={event.category} cover={coverFor(event)} className="aspect-[2/1] w-24 shrink-0 rounded-lg" sizes="96px" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-bold text-fg">{event.title}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-fg-2">
          <span className="inline-flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5 text-fg-3" />{formatDate(event.starts_at)}</span>
          <span className="inline-flex items-center gap-1"><Users aria-hidden="true" className="size-3.5 text-fg-3" />{attendanceCount(event)}</span>
        </p>
      </div>
    </Link>
  );
}
