import { ArrowRight, CalendarDays, Code2, Gamepad2, Sparkles, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { HeroScene, Mascot } from "@/components/art/Art";
import { CubeCluster } from "@/components/art/Cubes";
import { TaglineWordmark } from "@/components/Logo";
import { EmptyState, Panel } from "@/components/ui/Blocks";
import { MailingListButton } from "@/components/ui/ClubLinkButtons";
import { EventCard } from "@/components/ui/EventCards";
import { SectionLabel, Skeleton } from "@/components/ui/Primitives";
import { button, card, container } from "@/components/ui/styles";
import { featured } from "@/content/highlights";
import { pitch, whatWeDo } from "@/content/join";
import { getEventLists } from "@/lib/events";

const whatWeDoIcons = { game_night: Gamepad2, social: Users, game_jam: Trophy, workshop: Code2 } as const;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 hidden lg:block bg-[radial-gradient(ellipse_at_top_right,#123a5f_0%,transparent_60%),radial-gradient(ellipse_at_bottom_left,#0b2742_0%,transparent_55%)]" />
        <HeroScene className="-z-10" />
        <div className={`${container} pt-12 pb-40 sm:pt-20 sm:pb-44 lg:pt-28 lg:pb-36`}>
          <div className="max-w-xl">
            <SectionLabel>University of Michigan</SectionLabel>
            <h1 className="mt-5">
              <TaglineWordmark preload className="h-auto w-full max-w-[min(100%,540px)]" />
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-fg sm:text-xl">{pitch}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/join" className={button({ size: "lg" })}>
                <Users aria-hidden="true" />
                Join the Community
              </Link>
              <Link href="/events" className={button({ variant: "secondary", size: "lg" })}>
                <CalendarDays aria-hidden="true" />
                View Events
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className={`${container} space-y-8 sm:space-y-10`}>
        {/* Upcoming events + featured */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Panel
            title="Upcoming Events"
            icon={CalendarDays}
            action={
              <Link href="/events" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-fg-2 hover:text-maize">
                View all <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            }
          >
            <Suspense fallback={<div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-72" /><Skeleton className="hidden h-72 sm:block" /><Skeleton className="hidden h-72 sm:block" /></div>}>
              <UpcomingEvents />
            </Suspense>
          </Panel>
          <FeaturedPanel />
        </div>

        {/* Join banner */}
        <section className={`relative overflow-hidden ${card} bg-linear-to-r from-[#11365a] via-surface to-[#0d2741]`}>
          <CubeCluster
            className="absolute -top-4 right-2 hidden h-40 opacity-80 sm:block"
            viewBox="0 0 160 160"
            cubes={[
              { x: 110, y: 20, s: 34, tone: "maize", float: "a" },
              { x: 60, y: 70, s: 26, tone: "blue", float: "b" },
              { x: 130, y: 96, s: 20, tone: "sky", float: "c" },
            ]}
          />
          <div className="relative flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:gap-8 sm:p-8 sm:pl-12 sm:text-left">
            <Mascot className="h-48 shrink-0 sm:h-52" />
            <div className="flex-1">
              <h2 className="text-2xl text-fg sm:text-3xl">
                Build <span className="text-maize">·</span> Create <span className="text-maize">·</span> Connect
              </h2>
              <p className="mt-2 max-w-xl text-fg-2">
                Game nights, hangouts and the occasional game jam. If you like Roblox, you&apos;ll fit right in.
                No experience needed.
              </p>
            </div>
            <Link href="/join" className={button({ size: "lg", className: "shrink-0" })}>
              <Users aria-hidden="true" />
              Join the Community
            </Link>
          </div>
        </section>

        {/* What we do */}
        <section aria-labelledby="what-we-do">
          <h2 id="what-we-do" className="sr-only">What we do</h2>
          <ul className={`grid gap-px overflow-hidden rounded-2xl border border-line/70 bg-line/60 sm:grid-cols-2 lg:grid-cols-4`}>
            {whatWeDo.map((item) => {
              const Icon = whatWeDoIcons[item.key];
              return (
                <li key={item.key} className="flex gap-4 bg-surface p-5 sm:p-6">
                  <Icon aria-hidden="true" className="size-9 shrink-0 text-maize" strokeWidth={1.75} />
                  <div>
                    <h3 className="text-lg text-fg">{item.title}</h3>
                    <p className="mt-1 text-sm text-fg-2">{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}

async function UpcomingEvents() {
  const { upcoming } = await getEventLists();
  if (upcoming.length === 0) {
    return (
      <EmptyState
        title="Ready for the next game night?"
        action={<MailingListButton />}
      >
        New events are announced on our Discord and Instagram. Check back soon.
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {upcoming.slice(0, 3).map((event) => (
        <li key={event.id}>
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  );
}

function FeaturedPanel() {
  return (
    <section className={`relative flex flex-col overflow-hidden ${card} p-6`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgb(240_196_19/0.16),transparent_55%)]" />
      <CubeCluster
        className="absolute -right-4 -bottom-4 h-36 opacity-70"
        viewBox="0 0 160 140"
        cubes={[
          { x: 110, y: 30, s: 34, tone: "maize" },
          { x: 66, y: 62, s: 28, tone: "blue" },
          { x: 130, y: 82, s: 22, tone: "navy" },
        ]}
      />
      <div className="relative flex flex-1 flex-col">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-maize">
          <Sparkles aria-hidden="true" className="size-4" />
          {featured.kicker}
        </p>
        <Trophy aria-hidden="true" className="mt-5 size-12 text-maize" strokeWidth={1.5} />
        <h2 className="mt-3 text-2xl leading-tight text-fg">{featured.title}</h2>
        <p className="mt-3 text-fg-2">{featured.body}</p>
        <Link
          href="/join"
          className="mt-auto inline-flex min-h-11 items-center gap-1 self-start pt-6 text-sm font-semibold text-maize hover:underline"
        >
          Be part of the next one <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}
