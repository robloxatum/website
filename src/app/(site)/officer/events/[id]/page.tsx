import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice, SkeletonBlock } from "@/components/Notice";
import { OfficersOnly } from "@/components/OfficersOnly";
import { getOfficer } from "@/lib/auth";
import { isUuid } from "@/lib/events";
import { formatLongDate, formatTime, formatTimeRange, toClubInputValue } from "@/lib/time";
import { deleteEvent, regenerateCode, removeAttendance } from "../../actions";
import { ActionButton } from "../../_components/ActionButton";
import { CheckinToggle } from "../../_components/CheckinControls";
import { EventForm } from "../../_components/EventForm";
import { getAttendees, getOfficerEvent } from "../../data";

export const metadata: Metadata = { title: "Manage event" };

export default function ManageEventPage(props: PageProps<"/officer/events/[id]">) {
  return (
    <div>
      <Link href="/officer" className="font-display text-sm uppercase hover:underline">
        ← Dashboard
      </Link>
      <Suspense fallback={<SkeletonBlock className="mt-4 h-96" />}>
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
  const { event, code } = data;

  return (
    <div className="mt-4 space-y-8">
      <div>
        <h1 className="text-3xl leading-tight sm:text-4xl">{event.title}</h1>
        <p className="mt-1 font-semibold">
          {formatLongDate(event.starts_at)} · {formatTimeRange(event.starts_at, event.ends_at)}
          {event.location && ` · ${event.location}`}
        </p>
      </div>

      {saved && <Notice tone="success" title="Saved!" />}

      <section className="block-card space-y-4 bg-blue p-5 text-white">
        <h2 className="text-xl text-maize">Check-in</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="font-display text-xs uppercase text-sky">Code</p>
            <p className="font-display text-5xl tracking-[0.2em] text-maize">{code ?? "—"}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/officer/events/${event.id}/present`} className="btn btn-maize">
              Present QR
            </Link>
            <ActionButton
              action={regenerateCode.bind(null, event.id)}
              confirmText="Make a new code? The old code and QR stop working immediately."
              className="btn btn-white"
            >
              New code
            </ActionButton>
          </div>
        </div>
        <div className="border-t-2 border-white/20 pt-4 [&_.tag]:text-blue">
          <CheckinToggle
            key={`${event.checkin_open}-${event.checkin_reopened}-${event.ends_at}`}
            eventId={event.id}
            initial={{ checkin_open: event.checkin_open, checkin_reopened: event.checkin_reopened, ends_at: event.ends_at }}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">
            Attendance <span className="tag bg-maize align-middle">{attendees.length}</span>
          </h2>
          <a href={`/officer/events/${event.id}/attendance.csv`} className="btn btn-white btn-sm" download>
            Export CSV
          </a>
        </div>
        {attendees.length === 0 ? (
          <p className="block-card p-4">Nobody has checked in yet.</p>
        ) : (
          <div className="block-card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream font-display text-xs uppercase">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Uniqname</th>
                  <th className="p-3">Roblox</th>
                  <th className="p-3">Time</th>
                  <th className="p-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-blue/10">
                {attendees.map((a) => (
                  <tr key={a.user_id}>
                    <td className="p-3 font-semibold">{a.profiles?.full_name || "—"}</td>
                    <td className="p-3">{a.profiles?.uniqname}</td>
                    <td className="p-3">{a.profiles?.roblox_username ?? ""}</td>
                    <td className="p-3 whitespace-nowrap">{formatTime(a.checked_in_at)}</td>
                    <td className="p-3 text-right">
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

      <section>
        <h2 className="mb-3 text-xl">Edit details</h2>
        <EventForm
          defaults={{
            id: event.id,
            title: event.title,
            location: event.location,
            description: event.description,
            starts_at: toClubInputValue(event.starts_at),
            ends_at: toClubInputValue(event.ends_at),
          }}
        />
      </section>

      <section className="block-card border-brick p-5">
        <h2 className="text-xl">Danger zone</h2>
        <p className="mb-3 text-sm">Deleting an event also deletes its attendance records.</p>
        <ActionButton
          action={deleteEvent.bind(null, event.id)}
          confirmText={`Delete "${event.title}" and all ${attendees.length} check-ins? This can't be undone.`}
          className="btn btn-danger btn-sm"
        >
          Delete event
        </ActionButton>
      </section>
    </div>
  );
}
