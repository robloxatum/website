import { ArrowRight, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AboutStory, FoundersGrid, Timeline } from "@/components/content/About";
import { SectionLabel, Skeleton } from "@/components/ui/Primitives";
import { button, card, container } from "@/components/ui/styles";
import { pageMetadata } from "@/lib/metadata";
import { fullAvatarsFor } from "@/lib/roblox";
import { getAboutContent } from "@/lib/site-content-data";

export const metadata: Metadata = pageMetadata({
  title: "Our story",
  description: "How Roblox at UM started, what we've done since, and the people who founded it.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className={`${container} max-w-4xl! pt-10`}>
      <SectionLabel className="mb-3">About</SectionLabel>
      <h1 className="text-3xl leading-tight text-fg sm:text-4xl lg:text-5xl">Our story</h1>
      <Suspense fallback={<Skeleton className="mt-6 h-[36rem]" />}>
        <AboutContent />
      </Suspense>
    </div>
  );
}

async function AboutContent() {
  const { story, timeline, people } = await getAboutContent();
  // Cached about an hour each; initials when Roblox is unavailable.
  const avatars = await fullAvatarsFor(people);
  return (
    <>
      {story && (
        <div className="mt-6">
          <AboutStory story={story} />
        </div>
      )}

      {timeline.length > 0 && (
        <section aria-labelledby="timeline" className="mt-14">
          <SectionLabel>Milestones</SectionLabel>
          <h2 id="timeline" className="mt-2 text-2xl text-fg">
            How we got here
          </h2>
          <Timeline items={timeline} />
        </section>
      )}

      <section aria-labelledby="founders" id="team" className="mt-14 scroll-mt-24">
        <SectionLabel>The team</SectionLabel>
        <h2 id="founders" className="mt-2 scroll-mt-24 text-2xl text-fg">
          Founders
        </h2>
        {people.length ? (
          <FoundersGrid people={people.map((p, i) => ({ name: p.name, role: p.role, blurb: p.blurb, avatar: avatars[i] }))} />
        ) : (
          <div className={`${card} mt-6 flex items-center gap-4 p-5`}>
            <Users aria-hidden="true" className="size-8 shrink-0 text-maize" />
            <p className="text-fg-2">Founder profiles are coming soon.</p>
          </div>
        )}
      </section>

      <div className="mt-14 flex flex-col items-center gap-3 text-center">
        <p className="text-fg-2">Want to be part of the next chapter?</p>
        <Link href="/join" className={button()}>
          Join Roblox at UM
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
