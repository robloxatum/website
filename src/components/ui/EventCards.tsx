import { ArrowRight, CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { EventCover } from "@/components/art/Art";
import { formatDate, formatTime } from "@/lib/time";
import type { ListedEvent } from "@/lib/types";
import { CategoryBadge, StatusPill } from "./Primitives";
import { cardInteractive } from "./styles";

export function EventMeta({ event, className = "" }: { event: Pick<ListedEvent, "starts_at" | "location">; className?: string }) {
  return (
    <div className={`space-y-1.5 text-sm text-fg-2 ${className}`}>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="size-4 text-fg-3" />
          {formatDate(event.starts_at)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 aria-hidden="true" className="size-4 text-fg-3" />
          {formatTime(event.starts_at)}
        </span>
      </p>
      <p className="flex items-center gap-1.5">
        <MapPin aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
        <span className="truncate">{event.location || "Location TBA"}</span>
      </p>
    </div>
  );
}

/**
 * Public event card with cover art (home and /events). A compact row with a
 * square thumbnail on phones (like the mobile mockup), a tall card from sm up.
 */
export function EventCard({ event, headingLevel = "h3" }: { event: ListedEvent; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <Link
      href={`/events/${event.id}`}
      className={`group flex h-full gap-3 overflow-hidden p-3 sm:flex-col sm:gap-0 sm:p-0 ${cardInteractive}`}
    >
      <EventCover
        category={event.category}
        className="aspect-square w-24 shrink-0 self-start rounded-xl sm:aspect-[16/8] sm:w-full sm:rounded-none"
        sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 96px"
      />
      <div className="relative flex min-w-0 flex-1 flex-col sm:p-4 sm:pt-0">
        <CategoryBadge category={event.category} className="relative self-start sm:-mt-3" />
        <Heading className="mt-1.5 line-clamp-2 text-base leading-snug text-fg sm:mt-2 sm:text-lg">{event.title}</Heading>
        <EventMeta event={event} className="mt-1.5 sm:mt-2" />
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 sm:pt-4">
          {event.status === "completed" && event.attendance !== null ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-fg-2">
              <Users aria-hidden="true" className="size-4 text-fg-3" />
              {event.attendance} attended
            </span>
          ) : (
            <StatusPill status={event.status} />
          )}
          {event.status === "completed" ? (
            event.attendance !== null && <StatusPill status="completed" />
          ) : (
            <span className="hidden items-center gap-1 text-sm font-semibold text-maize sm:inline-flex">
              Details
              <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Grid of event cards. */
export function EventGrid({ events, headingLevel = "h3" }: { events: ListedEvent[]; headingLevel?: "h2" | "h3" }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {events.map((event) => (
        <li key={event.id}>
          <EventCard event={event} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}

/** Compact "next event" row with a date block (used on /join). */
export function NextEventRow({ event }: { event: ListedEvent }) {
  const [weekday, rest] = formatDate(event.starts_at).split(", ");
  const [month, day] = (rest ?? "").split(" ");
  return (
    <Link
      href={`/events/${event.id}`}
      className={`flex items-center gap-4 p-3 pr-4 ${cardInteractive}`}
    >
      <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-maize py-1.5 text-navy">
        <span className="text-[11px] font-bold uppercase">{weekday}</span>
        <span className="font-display text-2xl leading-none font-extrabold">{day}</span>
        <span className="text-[11px] font-bold uppercase">{month}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wider text-maize uppercase">
          {event.status === "live" ? "Happening now" : "Next event"}
        </p>
        <p className="truncate font-display text-base font-bold text-fg">{event.title}</p>
        <p className="truncate text-sm text-fg-2">
          {formatTime(event.starts_at)} · {event.location || "Location TBA"}
        </p>
      </div>
      <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-fg-3" />
    </Link>
  );
}
