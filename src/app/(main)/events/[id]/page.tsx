import { ArrowLeft, CalendarDays, Clock3, MapPin, QrCode, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventCover } from "@/components/art/Art";
import { CalendarButton } from "@/components/ui/ClubLinkButtons";
import { CategoryBadge, Skeleton, StatusPill } from "@/components/ui/Primitives";
import { button, card, container } from "@/components/ui/styles";
import { eventStatus, getEventLists, getPublicEvent } from "@/lib/events";
import { formatLongDate, formatTimeRange } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const event = await getPublicEvent((await params).id);
  return event ? { title: event.title, description: `${formatLongDate(event.starts_at)} · ${event.location || "Location TBA"}` } : {};
}

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <div className={`${container} max-w-4xl! pt-6 sm:pt-10`}>
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

  const status = eventStatus(event);
  // Aggregate count for ended events only (same rules as the list).
  const attendance =
    status === "completed" ? ((await getEventLists()).past.find((e) => e.id === event.id)?.attendance ?? null) : null;

  const facts = [
    { icon: CalendarDays, label: "Date", value: formatLongDate(event.starts_at) },
    { icon: Clock3, label: "Time", value: formatTimeRange(event.starts_at, event.ends_at) },
    { icon: MapPin, label: "Location", value: event.location || "Location TBA" },
    ...(attendance !== null ? [{ icon: Users, label: "Attendance", value: `${attendance} attended` }] : []),
  ];

  return (
    <article className={`mt-3 overflow-hidden ${card}`}>
      <EventCover category={event.category} className="aspect-[16/7] w-full sm:aspect-[16/6]" sizes="(min-width: 896px) 896px, 100vw" />
      <div className="relative p-5 sm:p-8 sm:pt-0">
        <div className="-mt-3 flex flex-wrap items-center gap-2">
          <CategoryBadge category={event.category} className="relative" />
          <StatusPill status={status} />
        </div>
        <h1 className="mt-3 text-3xl leading-tight text-fg sm:text-4xl">{event.title}</h1>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
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

        {event.description && (
          <p className="mt-6 text-lg leading-relaxed whitespace-pre-line text-fg-2">{event.description}</p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {status !== "completed" && (
            <Link href="/checkin" className={button({ size: "lg" })}>
              <QrCode aria-hidden="true" />
              {status === "live" ? "I'm here: check in" : "Check in at the event"}
            </Link>
          )}
          <CalendarButton />
        </div>
      </div>
    </article>
  );
}
