import { CalendarDays, CircleCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JoinBanner } from "@/components/art/Art";
import { CubeCluster } from "@/components/art/Cubes";
import { FaqList, JoinWhatWeDo } from "@/components/content/SiteContent";
import { GoogleButton } from "@/components/GoogleButton";
import { BrandIcon } from "@/components/Logo";
import { ClubLinkButtons } from "@/components/ui/ClubLinkButtons";
import { NextEventRow } from "@/components/ui/EventCards";
import { YoureIn } from "@/components/join/YoureIn";
import { SectionLabel, Skeleton } from "@/components/ui/Primitives";
import { button, card, container } from "@/components/ui/styles";
import { art } from "@/content/art";
import { pitch, typicalMeeting } from "@/content/join";
import { getProfile } from "@/lib/auth";
import { getEventLists } from "@/lib/events";
import { getCommunityLinks, getJoinContent } from "@/lib/site-content-data";

export const metadata: Metadata = {
  title: "Join",
  description: `${pitch} Free, and no experience needed.`,
  openGraph: { title: "Join Roblox at UM", description: `${pitch} Free, and no experience needed.` },
  twitter: { title: "Join Roblox at UM", description: `${pitch} Free, and no experience needed.` },
};

// ?src=<label> (from flyer QR codes) is only read by analytics; the page ignores it.
export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className={`${container} max-w-2xl! pt-6 sm:pt-10`}>
          <Skeleton className="h-96" />
        </div>
      }
    >
      <JoinOrWelcome />
    </Suspense>
  );
}

/** Members who are already signed up get the "You're in" screen; everyone else the Join page. */
async function JoinOrWelcome() {
  const profile = await getProfile();
  if (profile?.onboarded_at) {
    return (
      <div className={`${container} max-w-xl! pt-10`}>
        <YoureIn profile={profile} />
      </div>
    );
  }
  return <JoinLanding />;
}

async function JoinLanding() {
  const [links, { faq, whatWeDo }] = await Promise.all([getCommunityLinks(), getJoinContent()]);
  return (
    <div className={`${container} max-w-2xl! pt-6 sm:pt-10`}>
      {/* Above the fold on a phone: who we are, next event, join actions. */}
      <JoinBanner className="mb-5" />
      <section className="relative">
        {!art.joinHero && (
          <CubeCluster
            className="pointer-events-none absolute -top-2 right-0 h-20 opacity-80 sm:h-28"
            viewBox="0 0 120 100"
            cubes={[
              { x: 80, y: 8, s: 26, tone: "maize", float: "a" },
              { x: 40, y: 40, s: 20, tone: "blue", float: "b" },
              { x: 100, y: 56, s: 14, tone: "sky", float: "c" },
            ]}
          />
        )}
        <BrandIcon className="size-12 sm:size-14" alt="" />
        <h1 className="mt-3 text-3xl leading-tight text-fg sm:text-4xl">
          Join <span className="text-maize">Roblox at UM</span>
        </h1>
        <p className="mt-2 text-base leading-relaxed text-fg-2 sm:text-lg">{pitch}</p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-fg">
          <span className="inline-flex items-center gap-1.5"><CircleCheck aria-hidden="true" className="size-4 text-ok" />Free</span>
          <span className="inline-flex items-center gap-1.5"><CircleCheck aria-hidden="true" className="size-4 text-ok" />No experience needed</span>
          <span className="inline-flex items-center gap-1.5"><CircleCheck aria-hidden="true" className="size-4 text-ok" />All U-M students</span>
        </p>
      </section>

      <div className="mt-5">
        <Suspense fallback={<div className={`h-[82px] ${card}`} />}>
          <NextEvent />
        </Suspense>
      </div>

      <section aria-label="Join actions" className="mt-5 space-y-3">
        <SignUp />
        <ClubLinkButtons links={links} />
      </section>

      {/* Below the fold */}
      {whatWeDo.length > 0 && (
        <section aria-labelledby="what" className="mt-12">
          <SectionLabel>What we do</SectionLabel>
          <h2 id="what" className="mt-2 text-2xl text-fg">Play, hang out, make friends</h2>
          <JoinWhatWeDo items={whatWeDo} />
        </section>
      )}

      <section aria-labelledby="meeting" className="mt-12">
        <SectionLabel>A typical meeting</SectionLabel>
        <h2 id="meeting" className="mt-2 text-2xl text-fg">What to expect</h2>
        <ol className={`mt-5 ${card} divide-y divide-line/50`}>
          {typicalMeeting.map((step, i) => (
            <li key={step} className="flex items-center gap-4 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-elevated font-display font-extrabold text-maize">
                {i + 1}
              </span>
              <span className="text-fg">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={`mt-12 ${card} relative overflow-hidden p-6`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgb(240_196_19/0.14),transparent_60%)]" />
        <div className="relative">
          <Sparkles aria-hidden="true" className="size-8 text-maize" />
          <h2 className="mt-3 text-2xl text-fg">No experience needed</h2>
          <p className="mt-2 text-fg-2">
            Never opened Roblox Studio? Perfect. Come play at a game night, learn the basics at a workshop, and
            team up with people who can show you around.
          </p>
        </div>
      </section>

      {faq.length > 0 && (
        <section aria-labelledby="faq" className="mt-12">
          <SectionLabel>FAQ</SectionLabel>
          <h2 id="faq" className="mt-2 text-2xl text-fg">Questions</h2>
          <FaqList items={faq} />
        </section>
      )}

      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <p className="text-fg-2">Want to see what&apos;s coming up first?</p>
        <Link href="/events" className={button({ variant: "secondary" })}>
          <CalendarDays aria-hidden="true" />
          Browse events
        </Link>
      </div>
    </div>
  );
}

async function NextEvent() {
  const { upcoming } = await getEventLists();
  const next = upcoming[0];
  if (!next) {
    return (
      <p className={`${card} flex items-center gap-3 p-4 text-sm text-fg-2`}>
        <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-maize" />
        Our next event will be announced soon. Join the GroupMe or Discord to hear first.
      </p>
    );
  }
  return <NextEventRow event={next} />;
}

function SignUp() {
  return (
    <div>
      <GoogleButton next="/join/done" label="Sign up with your umich account" />
      <p className="mt-2 text-center text-xs text-fg-3">
        Uses your umich.edu Google account. Then check-in at events is one tap.
      </p>
    </div>
  );
}
