import { ArrowRight, CalendarDays, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { HeroScene, Mascot } from "@/components/art/Art";
import { CubeCluster } from "@/components/art/Cubes";
import { FeaturedPanel, HomeWhatWeDo } from "@/components/content/SiteContent";
import { TaglineWordmark } from "@/components/Logo";
import { EmptyState, Panel } from "@/components/ui/Blocks";
import { MailingListButton } from "@/components/ui/ClubLinkButtons";
import { EventCard } from "@/components/ui/EventCards";
import { SectionLabel, Skeleton } from "@/components/ui/Primitives";
import { button, card, container } from "@/components/ui/styles";
import { art } from "@/content/art";
import { pitch } from "@/content/join";
import { getEventLists } from "@/lib/events";
import { getFeaturedPanel, getJoinContent } from "@/lib/site-content-data";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        {/* Glow behind the vector fallback only; a hero image blends straight into the page navy. */}
        {!art.hero && (
          <div className="absolute inset-0 -z-10 hidden lg:block bg-[radial-gradient(ellipse_at_top_right,#123a5f_0%,transparent_60%),radial-gradient(ellipse_at_bottom_left,#0b2742_0%,transparent_55%)]" />
        )}
        <HeroScene className="-z-10" />
        <div className={`${container} pt-12 pb-40 sm:pt-20 sm:pb-44 lg:pt-28 lg:pb-36`}>
          <div className="relative max-w-xl">
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
              {/* Solid backdrop so the scene doesn't show through the outline button. */}
              <Link href="/events" className={button({ variant: "secondary", size: "lg", className: "bg-bg/85! backdrop-blur-sm" })}>
                <CalendarDays aria-hidden="true" />
                View Events
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className={`${container} space-y-8 sm:space-y-10`}>
        {/* Upcoming events + featured */}
        <UpcomingAndFeatured>
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
        </UpcomingAndFeatured>

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
          <WhatWeDo />
        </section>

        {/* Our story teaser */}
        <p className="text-center text-sm text-fg-2">
          Founded Oct 2025 <span aria-hidden="true" className="text-maize">·</span>{" "}
          <Link href="/about#team" className="inline-flex min-h-11 items-center gap-1 font-semibold text-maize hover:underline">
            Meet the team <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
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
  // Fill the panel: one event gets a wide card, two share the row, three go up to three columns.
  const shown = upcoming.slice(0, 3);
  const cols = shown.length === 1 ? "" : shown.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3";
  return (
    <ul className={`grid gap-4 ${cols}`}>
      {shown.map((event) => (
        <li key={event.id}>
          <EventCard event={event} layout={shown.length === 1 ? "wide" : "card"} alignTitles={shown.length > 1} />
        </li>
      ))}
    </ul>
  );
}

/** Upcoming events, with the officer-set Featured panel beside them when it's on (cached; see lib/site-content-data). */
async function UpcomingAndFeatured({ children }: { children: React.ReactNode }) {
  const featured = await getFeaturedPanel();
  if (!featured) return <div>{children}</div>;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {children}
      <FeaturedPanel featured={featured} />
    </div>
  );
}

async function WhatWeDo() {
  const { whatWeDo } = await getJoinContent();
  return whatWeDo.length ? <HomeWhatWeDo items={whatWeDo} /> : null;
}
