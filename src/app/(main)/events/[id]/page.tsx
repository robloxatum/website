import { ArrowLeft, CalendarDays, Clock3, MapPin, QrCode, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { EventCover } from "@/components/art/Art";
import { FlyerViewer } from "@/components/events/FlyerViewer";
import { AddToCalendar } from "@/components/events/AddToCalendar";
import { JoinGameIfCheckedIn } from "@/components/events/JoinGame";
import { RsvpToggle } from "@/components/events/RsvpToggle";
import { CalendarButton } from "@/components/ui/ClubLinkButtons";
import { CategoryBadge, Skeleton, StatusPill } from "@/components/ui/Primitives";
import { button, card, container } from "@/components/ui/styles";
import { coverFor } from "@/lib/event-covers";
import { eventStatus, getEventLists, getPublicEvent } from "@/lib/events";
import { flyerOf, flyerUrl } from "@/lib/flyers";
import { formatLongDate, formatTimeRange } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const event = await getPublicEvent((await params).id);
  return event ? { title: event.title, description: `${formatLongDate(event.starts_at)} · ${event.location || "Location TBA"}` } : {};
}

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <div className={`${container} max-w-5xl! pt-6 sm:pt-10`}>
      <Link href="/events" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-fg-2 hover:text-maize">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All events
      </Link>
      <Suspense fallback={<Skeleton className="mt-3 h-96" />}>
        <EventDetails params={params} />
      </Suspense>
    </div>
  );
}

async function EventDetails({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  const { id } = await params;
  const event = await getPublicEvent(id);
  if (!event) notFound();

  const flyer = flyerOf(event);
  // Same cover as the event's card: lists pick covers so neighbours differ, so
  // look the event up in its list (cached) and fall back to its own pick.
  const lists = await getEventLists();
  // Upcoming / live / ended depends on the current time, so work it out per
  // request (this part already streams inside <Suspense>; the cached data above
  // stays cached).
  await connection();
  const status = eventStatus(event);
  const listed = [...lists.upcoming, ...lists.past].find((e) => e.id === event.id);
  const cover = listed ? listed.cover : coverFor(event);
  // Aggregate count for ended events only (same rules as the list).
  const attendance = status === "completed" ? (listed?.attendance ?? null) : null;

  const facts = [
    { icon: CalendarDays, label: "Date", value: formatLongDate(event.starts_at) },
    { icon: Clock3, label: "Time", value: formatTimeRange(event.starts_at, event.ends_at) },
    { icon: MapPin, label: "Location", value: event.location || "Location TBA" },
    ...(attendance !== null ? [{ icon: Users, label: "Attendance", value: `${attendance} attended` }] : []),
  ];

  return (
    // No overflow-hidden here: the "Add to calendar" menu must be able to extend
    // past the card. The cover clips its own corners instead.
    <article className={`mt-3 ${card}`}>
      <EventCover
        category={event.category}
        cover={cover}
        preload
        className="aspect-[2/1] w-full rounded-t-2xl sm:aspect-[5/2]"
        sizes="(min-width: 1024px) 1024px, 100vw"
      />
      {/* Reading order: title, details, game link, flyer, then description and buttons. From lg
          up the flyer moves to a column on the right, beside everything else. */}
      <div
        className={`relative p-5 sm:p-8 sm:pt-0 ${flyer ? "lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_auto_auto_1fr] lg:gap-x-10" : ""}`}
      >
        <div className="lg:col-start-1">
          <div className="-mt-3 flex flex-wrap items-center gap-2">
            <CategoryBadge category={event.category} className="relative" />
            <StatusPill status={status} />
          </div>
          <h1 className="mt-3 text-3xl leading-tight text-fg sm:text-4xl">{event.title}</h1>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:col-start-1">
          {facts.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-line/60 bg-bg-2/60 p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-elevated">
                <Icon aria-hidden="true" className="size-5 text-maize" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs font-semibold tracking-wider text-fg-3 uppercase">{label}</dt>
                <dd className="font-semibold text-fg">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        {/* Checked-in members only (worked out in the browser), while the event isn't over. */}
        {status !== "completed" && (
          <JoinGameIfCheckedIn eventId={event.id} startsAt={event.starts_at} endsAt={event.ends_at} className="mt-6 lg:col-start-1" />
        )}

        {flyer && (
          <section aria-labelledby="flyer-heading" className="mt-8 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:mt-8">
            <h2 id="flyer-heading" className="mb-3 text-xl text-fg">Flyer</h2>
            <FlyerViewer
              src={flyerUrl(flyer.path)}
              width={flyer.width}
              height={flyer.height}
              alt={`Flyer for ${event.title}`}
              sizes="(min-width: 1024px) 300px, (min-width: 640px) 576px, calc(100vw - 40px)"
              eager
            />
          </section>
        )}

        <div className="lg:col-start-1">
          {event.description && (
            <p className="mt-6 max-w-prose text-lg leading-relaxed whitespace-pre-line text-fg-2">{event.description}</p>
          )}

          {status !== "completed" && <RsvpToggle event={event} className="mt-8" />}

          {/* Wraps to a second row when the buttons don't fit side by side (e.g. tablets). */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {status !== "completed" && (
              <Link href="/checkin" className={button({ size: "lg" })}>
                <QrCode aria-hidden="true" />
                {status === "live" ? "I'm here: check in" : "Check in at the event"}
              </Link>
            )}
            {/* Past events: no "Add to calendar" (or RSVP). */}
            {status !== "completed" && <AddToCalendar event={event} />}
            <CalendarButton />
          </div>
        </div>
      </div>
    </article>
  );
}
