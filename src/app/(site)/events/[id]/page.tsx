import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DateBlock } from "@/components/EventCard";
import { SkeletonBlock } from "@/components/Notice";
import { getPublicEvent } from "@/lib/events";
import { formatLongDate, formatTimeRange, hasPassed } from "@/lib/time";

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <Suspense fallback={<SkeletonBlock className="h-64" />}>
      <EventDetails params={params} />
    </Suspense>
  );
}

async function EventDetails({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  const { id } = await params;
  const event = await getPublicEvent(id);
  if (!event) notFound();

  const ended = hasPassed(event.ends_at);

  return (
    <article>
      <Link href="/events" className="font-display text-sm uppercase hover:underline">
        ← All events
      </Link>
      <div className="block-card mt-4 p-5 sm:p-8">
        <div className="flex gap-4">
          <DateBlock iso={event.starts_at} />
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight sm:text-4xl">{event.title}</h1>
            <p className="mt-2 font-semibold">
              {formatLongDate(event.starts_at)} · {formatTimeRange(event.starts_at, event.ends_at)}
            </p>
            {event.location && <p className="text-blue/70">📍 {event.location}</p>}
          </div>
        </div>
        {event.description && (
          <p className="mt-6 whitespace-pre-line text-lg leading-relaxed">{event.description}</p>
        )}
        {!ended && (
          <Link href="/checkin" className="btn btn-maize mt-6">
            Check in
          </Link>
        )}
      </div>
    </article>
  );
}
