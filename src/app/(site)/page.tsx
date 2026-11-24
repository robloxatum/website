import Link from "next/link";
import { DateBlock } from "@/components/EventCard";
import { CubeIcon } from "@/components/Logo";
import { getEventLists } from "@/lib/events";
import { formatLongDate, formatTimeRange } from "@/lib/time";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="block-card relative overflow-hidden bg-blue p-6 text-white sm:p-10">
        <div className="relative z-10 max-w-xl">
          <p className="font-display text-sm uppercase text-sky">University of Michigan</p>
          <h1 className="mt-2 text-4xl leading-[1.05] text-maize sm:text-6xl">
            Build. Script. Play.
          </h1>
          <p className="mt-4 text-lg text-white/90">
            We&apos;re UM students who make games together: game jams, scripting workshops and
            playtest nights. No experience needed.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/events" className="btn btn-maize">
              See events
            </Link>
            <Link href="/links" className="btn btn-white">
              Join us
            </Link>
          </div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute right-6 bottom-4 hidden gap-2 opacity-90 md:flex">
          <CubeIcon className="size-28 rotate-6 sm:size-40" />
          <CubeIcon className="size-16 -rotate-12 self-start sm:size-24" />
        </div>
      </section>

      <NextEvent />
    </div>
  );
}

async function NextEvent() {
  const { upcoming } = await getEventLists();
  const next = upcoming[0];

  return (
    <section>
      <h2 className="mb-4 text-2xl">Next up</h2>
      {next ? (
        <div className="block-card p-5 sm:p-6">
          <div className="flex gap-4">
            <DateBlock iso={next.starts_at} />
            <div className="min-w-0">
              <h3 className="text-2xl leading-tight">{next.title}</h3>
              <p className="mt-1 font-semibold">
                {formatLongDate(next.starts_at)} · {formatTimeRange(next.starts_at, next.ends_at)}
              </p>
              {next.location && <p className="text-blue/70">📍 {next.location}</p>}
            </div>
          </div>
          {next.description && (
            <p className="mt-4 line-clamp-3 whitespace-pre-line text-blue/80">{next.description}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/checkin" className="btn btn-maize">
              I&apos;m here: check in
            </Link>
            <Link href={`/events/${next.id}`} className="btn btn-white">
              Details
            </Link>
          </div>
        </div>
      ) : (
        <div className="block-card p-5">
          <p className="font-semibold">No events on the calendar yet.</p>
          <p className="text-blue/70">Check back soon, or follow us for announcements.</p>
          <Link href="/links" className="btn btn-white mt-4">
            Our links
          </Link>
        </div>
      )}
    </section>
  );
}
