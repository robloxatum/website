import Link from "next/link";
import { formatDate, formatTimeRange } from "@/lib/time";
import type { PublicEvent } from "@/lib/types";

export function DateBlock({ iso }: { iso: string }) {
  const [weekday, rest] = formatDate(iso).split(", ");
  const [month, day] = (rest ?? "").split(" ");
  return (
    <div className="flex w-16 shrink-0 flex-col items-center border-4 border-blue bg-maize py-1 text-blue">
      <span className="font-display text-xs uppercase">{weekday}</span>
      <span className="font-display text-2xl leading-none">{day}</span>
      <span className="font-display text-xs uppercase">{month}</span>
    </div>
  );
}

export function EventCard({ event, muted = false }: { event: PublicEvent; muted?: boolean }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className={`block-card flex gap-4 p-4 transition-transform hover:-translate-y-0.5 ${muted ? "opacity-75" : ""}`}
    >
      <DateBlock iso={event.starts_at} />
      <div className="min-w-0">
        <h3 className="text-lg leading-tight">{event.title}</h3>
        <p className="mt-1 text-sm font-semibold">{formatTimeRange(event.starts_at, event.ends_at)}</p>
        {event.location && <p className="text-sm text-blue/70">📍 {event.location}</p>}
      </div>
    </Link>
  );
}
