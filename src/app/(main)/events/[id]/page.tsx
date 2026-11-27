import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, MapPin, QrCode, Users } from "lucide-react";
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
import { isCheckInTime } from "@/lib/event-day";
import { eventStatus, getEventLists, getPublicEvent } from "@/lib/events";
import { flyerOf, flyerUrl } from "@/lib/flyers";
import type { PublicEvent } from "@/lib/types";
import { coverPreviewImage, pageMetadata } from "@/lib/metadata";
import { resolveLocation } from "@/lib/locations";
import { formatDate, formatLongDate, formatTimeRange, formatTimeRangeShort } from "@/lib/time";

/** Link previews: the event's cover, title, and date · time · place. */
export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const event = await getPublicEvent((await params).id);
  if (!event) return { title: "Event not found" };
  // Same cover as the event's card and page (cached lists).
  const lists = await getEventLists();
  const listed = [...lists.upcoming, ...lists.past].find((e) => e.id === event.id);
  const cover = listed ? listed.cover : coverFor(event);
  const when = `${formatLongDate(event.starts_at)} · ${formatTimeRange(event.starts_at, event.ends_at)}`;
  return pageMetadata({
    title: event.title,
    description: `${when} · ${event.location || "Location TBA"}`,
    path: `/events/${event.id}`,
    image: coverPreviewImage(cover, event.title),
  });
}

/**
 * Lets each event page be cached: its cover, title, details and flyer go in the
 * first HTML (fast first paint, link previews without waiting); only what
 * depends on the current time or the visitor streams in (status, attendance,
 * RSVP, the check-in / calendar buttons). Nothing is built ahead: each event is
 * rendered on its first visit, then cached. Pages built during the build would
 * serve that build-time copy once after an officer's edit or delete; pages
 * rendered at runtime refresh straight away. ("none" isn't a UUID: a 404.)
 */
export function generateStaticParams() {
  return [{ id: "none" }];
}

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <div className={`${container} max-w-5xl! pt-6 sm:pt-10`}>
      <Link href="/events" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-fg-2 hover:text-maize">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All events
      </Link>
      {/* Only for events not prerendered yet. Tall, so the footer doesn't jump when the event arrives. */}
      <Suspense fallback={<Skeleton className="mt-3 h-[150dvh]" />}>
        <EventDetails params={params} />
      </Suspense>
    </div>
  );
}

/** Upcoming / live / ended depends on the current time: worked out per request. */
async function currentStatus(event: PublicEvent) {
  await connection();
  return eventStatus(event);
}

/** From 2 hours before the start until the end: checking in becomes the main action. */
async function checkInTime(event: PublicEvent) {
  await connection();
  return isCheckInTime(event);
}

async function EventDetails({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  const { id } = await params;
  const event = await getPublicEvent(id);
  if (!event) notFound();

  const flyer = flyerOf(event);
  // Same cover as the event's card: lists pick covers so neighbours differ, so
  // look the event up in its list (cached) and fall back to its own pick.
  const lists = await getEventLists();
  const listed = [...lists.upcoming, ...lists.past].find((e) => e.id === event.id);
  const cover = listed ? listed.cover : coverFor(event);

  // Building codes spelled out here ("CCCB 1420" -> Central Campus Classroom Building, Room 1420); cards keep the code.
  const place = resolveLocation(event.location);
  const facts = [
    // Phones: date and time share a row (short date), so the RSVP button sits higher.
    { icon: CalendarDays, label: "Date", value: formatLongDate(event.starts_at), short: formatDate(event.starts_at), half: true },
    {
      icon: Clock3,
      label: "Time",
      value: formatTimeRange(event.starts_at, event.ends_at),
      short: formatTimeRangeShort(event.starts_at, event.ends_at),
      half: true,
    },
    { icon: MapPin, label: "Location", value: place?.label ?? "Location TBA", mapUrl: place?.mapUrl ?? null },
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
      {/* Reading order: title, details, RSVP (or check in on event day), game link, flyer, then description and the
          other buttons. From lg
          up the flyer moves to a column on the right, beside everything else. */}
      <div
        className={`relative p-5 sm:p-8 sm:pt-0 ${flyer ? "lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_auto_auto_auto_1fr] lg:gap-x-10" : ""}`}
      >
        <div className="lg:col-start-1">
          <div className="-mt-3 flex flex-wrap items-center gap-2">
            <CategoryBadge category={event.category} className="relative" />
            <Suspense fallback={null}>
              <LiveStatus event={event} />
            </Suspense>
          </div>
          <h1 className="mt-3 text-3xl leading-tight text-fg sm:text-4xl">{event.title}</h1>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 lg:col-start-1">
          {facts.map((f) => (
            <Fact key={f.label} {...f} />
          ))}
          <Suspense fallback={null}>
            <AttendanceFact event={event} attendance={listed?.attendance ?? null} />
          </Suspense>
        </dl>

        {/* The main action, right under the details (above the flyer on phones). */}
        <Suspense fallback={null}>
          <PrimaryActions event={event} />
        </Suspense>

        {/* Checked-in members only (worked out in the browser); it shows nothing once the event is over. */}
        <JoinGameIfCheckedIn eventId={event.id} startsAt={event.starts_at} endsAt={event.ends_at} className="mt-6 lg:col-start-1" />

        {flyer && (
          <section aria-labelledby="flyer-heading" className="mt-8 lg:col-start-2 lg:row-span-5 lg:row-start-1 lg:mt-8">
            <FlyerViewer
              heading="Flyer"
              headingId="flyer-heading"
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
          <Suspense fallback={null}>
            <EventActions event={event} />
          </Suspense>
        </div>
      </div>
    </article>
  );
}

/**
 * One fact (date, time, ...): valid dl markup, with the icon inside the dt.
 * Full width on phones unless `half` (then a short value if given); two per row
 * from sm up. Known buildings get a Map link that covers the whole card.
 */
function Fact({
  icon: Icon,
  label,
  value,
  short,
  half = false,
  mapUrl = null,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  short?: string;
  half?: boolean;
  mapUrl?: string | null;
}) {
  return (
    <div
      className={`relative flex min-h-16 flex-col justify-center rounded-xl border border-line/60 bg-bg-2/60 p-3 transition-colors duration-150 sm:col-span-1 sm:pl-16 ${
        half ? "" : "col-span-2"
      } ${mapUrl ? "has-[a:hover]:border-maize/60" : ""}`}
    >
      {/* Phones: a small icon beside the label, so two facts fit side by side. From sm: an icon tile on the left. */}
      <dt className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-fg-3 uppercase">
        <span aria-hidden="true" className="sm:absolute sm:top-1/2 sm:left-3 sm:grid sm:size-10 sm:-translate-y-1/2 sm:place-items-center sm:rounded-lg sm:bg-elevated">
          <Icon className="size-4 text-maize sm:size-5" />
        </span>
        {label}
      </dt>
      <dd className="min-w-0 font-semibold text-fg">
        {short ? (
          <>
            <span className="sm:hidden">{short}</span>
            <span className="max-sm:hidden">{value}</span>
          </>
        ) : (
          value
        )}
        {mapUrl && (
          <>
            {" "}
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-sm font-semibold whitespace-nowrap text-maize after:absolute after:inset-0 after:rounded-xl hover:underline"
            >
              Map
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
              <span className="sr-only">(Google Maps, opens in a new tab)</span>
            </a>
          </>
        )}
      </dd>
    </div>
  );
}

async function LiveStatus({ event }: { event: PublicEvent }) {
  return <StatusPill status={await currentStatus(event)} />;
}

/** Aggregate count, for ended events only (same rules as the list). */
async function AttendanceFact({ event, attendance }: { event: PublicEvent; attendance: number | null }) {
  if ((await currentStatus(event)) !== "completed" || attendance === null) return null;
  return <Fact icon={Users} label="Attendance" value={`${attendance} attended`} />;
}

function CheckInButton({ status, primary }: { status: string; primary: boolean }) {
  return (
    <Link href="/checkin" className={button({ variant: primary ? "primary" : "secondary", size: "lg" })}>
      <QrCode aria-hidden="true" />
      {status === "live" ? "I'm here: check in" : "Check in at the event"}
    </Link>
  );
}

/**
 * Under the details: RSVP is the yellow action until event day; from 2 hours
 * before the start until the end, "Check in" is, with RSVP next to it in
 * outline (one yellow button at a time). Nothing once the event is over.
 */
async function PrimaryActions({ event }: { event: PublicEvent }) {
  const status = await currentStatus(event);
  if (status === "completed") return null;
  const eventDay = await checkInTime(event);
  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start lg:col-start-1" data-testid="primary-actions">
      {eventDay && <CheckInButton status={status} primary />}
      <RsvpToggle event={event} primary={!eventDay} />
    </div>
  );
}

/** Check in (before event day), calendar buttons. Past events: subscribe only. */
async function EventActions({ event }: { event: PublicEvent }) {
  const status = await currentStatus(event);
  const eventDay = status !== "completed" && (await checkInTime(event));
  return (
    // Wraps to a second row when the buttons don't fit side by side (e.g. tablets).
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {status !== "completed" && !eventDay && <CheckInButton status={status} primary={false} />}
      {status !== "completed" && <AddToCalendar event={event} full="phone" />}
      <CalendarButton />
    </div>
  );
}
