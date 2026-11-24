import { BadgeCheck, CalendarDays, CircleCheck, Code2, Gamepad2, Sparkles, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CubeCluster } from "@/components/art/Cubes";
import { GoogleButton } from "@/components/GoogleButton";
import { BrandIcon } from "@/components/Logo";
import { ClubLinkButtons } from "@/components/ui/ClubLinkButtons";
import { NextEventRow } from "@/components/ui/EventCards";
import { SectionLabel } from "@/components/ui/Primitives";
import { button, card, container } from "@/components/ui/styles";
import { highlights } from "@/content/highlights";
import { faq, pitch, typicalMeeting, whatWeDo } from "@/content/join";
import { getProfile } from "@/lib/auth";
import { getEventLists } from "@/lib/events";

export const metadata: Metadata = {
  title: "Join",
  description: `${pitch} Free, and no experience needed.`,
  openGraph: { title: "Join Roblox at UM", description: `${pitch} Free, and no experience needed.` },
  twitter: { title: "Join Roblox at UM", description: `${pitch} Free, and no experience needed.` },
};

const icons = { game_night: Gamepad2, workshop: Code2, game_jam: Trophy, social: Users } as const;

// ?src=<label> (from flyer QR codes) is only read by analytics; the page ignores it.
export default function JoinPage() {
  return (
    <div className={`${container} max-w-2xl! pt-6 sm:pt-10`}>
      {/* Above the fold on a phone: who we are, next event, join actions. */}
      <section className="relative">
        <CubeCluster
          className="pointer-events-none absolute -top-2 right-0 h-20 opacity-80 sm:h-28"
          viewBox="0 0 120 100"
          cubes={[
            { x: 80, y: 8, s: 26, tone: "maize", float: "a" },
            { x: 40, y: 40, s: 20, tone: "blue", float: "b" },
            { x: 100, y: 56, s: 14, tone: "sky", float: "c" },
          ]}
        />
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
        <Suspense fallback={<SignUp />}>
          <PrimaryAction />
        </Suspense>
        <ClubLinkButtons keys={["discord", "instagram", "maizepages"]} />
      </section>

      {/* Below the fold */}
      <section aria-labelledby="highlights" className="mt-12">
        <h2 id="highlights" className="sr-only">Highlights</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {highlights.items.map((h) => (
            <li key={h.label} className={`${card} p-4`}>
              <p className="font-display text-2xl font-extrabold text-maize">{h.value}</p>
              <p className="mt-1 text-sm text-fg-2">{h.label}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="what" className="mt-12">
        <SectionLabel>What we do</SectionLabel>
        <h2 id="what" className="mt-2 text-2xl text-fg">Play, learn and build together</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {whatWeDo.map((item) => {
            const Icon = icons[item.key];
            return (
              <li key={item.key} className={`${card} flex gap-3 p-4`}>
                <Icon aria-hidden="true" className="size-7 shrink-0 text-maize" strokeWidth={1.75} />
                <div>
                  <h3 className="text-base text-fg">{item.title}</h3>
                  <p className="mt-0.5 text-sm text-fg-2">{item.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

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

      <section aria-labelledby="faq" className="mt-12">
        <SectionLabel>FAQ</SectionLabel>
        <h2 id="faq" className="mt-2 text-2xl text-fg">Questions</h2>
        <div className="mt-5 space-y-3">
          {faq.map((item) => (
            <details key={item.q} className={`group ${card} p-0 [&_summary::-webkit-details-marker]:hidden`}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 font-semibold text-fg">
                {item.q}
                <span aria-hidden="true" className="text-xl text-maize transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-5 text-fg-2">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

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
        Our next event will be announced soon. Join the Discord to hear first.
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

async function PrimaryAction() {
  const profile = await getProfile();
  if (!profile?.onboarded_at) return <SignUp />;
  return (
    <Link
      href="/join/done"
      className={`${card} flex min-h-13 items-center gap-3 border-ok/40 px-5 py-3.5 font-semibold text-fg hover:border-ok/70`}
    >
      <BadgeCheck aria-hidden="true" className="size-6 shrink-0 text-ok" />
      <span className="flex-1">You&apos;re a member. See your community links</span>
    </Link>
  );
}
