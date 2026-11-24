import { Download, MonitorPlay, RefreshCw, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/Blocks";
import { CategoryBadge, StatusPill } from "@/components/ui/Primitives";
import { button, card } from "@/components/ui/styles";
import { eventStatus } from "@/lib/events";
import { flyerOf } from "@/lib/flyers";
import type { OfficerEvent } from "@/lib/types";
import { formatLongDate, formatTime, formatTimeRange, toClubInputValue } from "@/lib/time";
import { deleteEvent, regenerateCode, removeAttendance } from "../actions";
import { ActionButton } from "./ActionButton";
import { CheckinToggle } from "./CheckinControls";
import { EventForm } from "./EventForm";
import { CapacityMeter } from "./OfficerEventCards";
import type { AttendeeRow } from "../data";

const th = "px-4 py-3 text-xs font-semibold tracking-wider text-fg-3 uppercase";

export function ManageEventView({
  event,
  code,
  attendees,
  saved,
}: {
  event: OfficerEvent;
  code: string | null;
  attendees: AttendeeRow[];
  saved: boolean;
}) {
  return (
    <div className="mt-2 space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={event.category} />
          <StatusPill status={eventStatus(event)} />
        </div>
        <h1 className="mt-2 text-3xl leading-tight text-fg sm:text-4xl">{event.title}</h1>
        <p className="mt-1 text-fg-2">
          {formatLongDate(event.starts_at)} · {formatTimeRange(event.starts_at, event.ends_at)}
          {event.location && ` · ${event.location}`}
        </p>
      </div>

      {saved && <Alert tone="success" title="Saved!" />}

      {/* Check-in */}
      <section className={`${card} relative overflow-hidden p-5 sm:p-6`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgb(240_196_19/0.12),transparent_55%)]" />
        <div className="relative space-y-5">
          <h2 className="text-xl text-fg">Check-in</h2>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs font-semibold tracking-wider text-fg-3 uppercase">Code</p>
              <p className="font-display text-5xl font-extrabold tracking-[0.2em] text-maize">{code ?? "—"}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/officer/events/${event.id}/present`} className={button()}>
                <MonitorPlay aria-hidden="true" />
                Present QR
              </Link>
              <ActionButton
                action={regenerateCode.bind(null, event.id)}
                confirmText="Make a new code? The old code and QR stop working immediately."
                className={button({ variant: "secondary" })}
              >
                <RefreshCw aria-hidden="true" />
                New code
              </ActionButton>
            </div>
          </div>
          <CapacityMeter count={attendees.length} capacity={event.capacity} />
          <div className="border-t border-line/50 pt-4">
            <CheckinToggle
              key={`${event.checkin_open}-${event.checkin_reopened}-${event.ends_at}`}
              eventId={event.id}
              initial={{ checkin_open: event.checkin_open, checkin_reopened: event.checkin_reopened, ends_at: event.ends_at }}
            />
          </div>
        </div>
      </section>

      {/* Attendance */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2.5 text-xl text-fg">
            <Users aria-hidden="true" className="size-6 text-maize" />
            Attendance
            <span className="rounded-md bg-maize px-2 py-0.5 text-sm font-bold text-navy tabular-nums">{attendees.length}</span>
          </h2>
          <a href={`/officer/events/${event.id}/attendance.csv`} className={button({ variant: "secondary", size: "sm" })} download>
            <Download aria-hidden="true" />
            Export CSV
          </a>
        </div>
        {attendees.length === 0 ? (
          <div className={card}>
            <EmptyState title="Nobody has checked in yet">Open check-in and put the QR on screen with Present.</EmptyState>
          </div>
        ) : (
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line/60 bg-bg-2/60">
                <tr>
                  <th scope="col" className={th}>Name</th>
                  <th scope="col" className={th}>Uniqname</th>
                  <th scope="col" className={`${th} hidden sm:table-cell`}>Roblox</th>
                  <th scope="col" className={th}>Time</th>
                  <th scope="col" className={th}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {attendees.map((a) => (
                  <tr key={a.user_id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-semibold text-fg">{a.profiles?.full_name || "—"}</td>
                    <td className="px-4 py-3 text-fg-2">{a.profiles?.uniqname}</td>
                    <td className="hidden px-4 py-3 text-fg-2 sm:table-cell">{a.profiles?.roblox_username ?? ""}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-fg-2">{formatTime(a.checked_in_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <ActionButton
                        action={removeAttendance.bind(null, event.id, a.user_id)}
                        confirmText={`Remove ${a.profiles?.full_name || a.profiles?.uniqname}'s check-in?`}
                      >
                        Remove
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit */}
      <section>
        <h2 className="mb-3 text-xl text-fg">Edit details</h2>
        <EventForm
          defaults={{
            id: event.id,
            title: event.title,
            location: event.location,
            description: event.description,
            starts_at: toClubInputValue(event.starts_at),
            ends_at: toClubInputValue(event.ends_at),
            category: event.category,
            capacity: event.capacity,
            flyer: flyerOf(event),
          }}
        />
      </section>

      <section className="rounded-2xl border border-bad/40 bg-bad/[0.06] p-5">
        <h2 className="text-xl text-fg">Danger zone</h2>
        <p className="mt-1 mb-4 text-sm text-fg-2">Deleting an event also deletes its attendance records.</p>
        <ActionButton
          action={deleteEvent.bind(null, event.id)}
          confirmText={`Delete "${event.title}" and all ${attendees.length} check-ins? This can't be undone.`}
          className={button({ variant: "danger", size: "sm" })}
        >
          <Trash2 aria-hidden="true" />
          Delete event
        </ActionButton>
      </section>
    </div>
  );
}
