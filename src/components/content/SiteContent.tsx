import { ArrowRight, Code2, Gamepad2, Minus, Plus, Sparkles, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { FeaturedArt } from "@/components/art/Art";
import { CubeCluster } from "@/components/art/Cubes";
import { card } from "@/components/ui/styles";
import { art } from "@/content/art";
import type { FaqItem, FeaturedPanelContent, WhatWeDoItem } from "@/lib/site-content";

/**
 * Officer-editable content blocks. Plain components (no data loading) so the
 * public pages and the officer preview render exactly the same thing.
 */

const WHAT_WE_DO_ICONS = { game_night: Gamepad2, social: Users, game_jam: Trophy, workshop: Code2 } as const;

/** "What we do" cards on /join. */
export function JoinWhatWeDo({ items }: { items: WhatWeDoItem[] }) {
  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const Icon = WHAT_WE_DO_ICONS[item.key];
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
  );
}

/** "What we do" strip on the home page. */
export function HomeWhatWeDo({ items }: { items: WhatWeDoItem[] }) {
  return (
    <ul className={`grid gap-px overflow-hidden rounded-2xl border border-line/70 bg-line/60 sm:grid-cols-2 lg:grid-cols-4`}>
      {items.map((item) => {
        const Icon = WHAT_WE_DO_ICONS[item.key];
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
  );
}

/** Join page FAQ: one expandable card per question. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="mt-5 space-y-3">
      {items.map((item, i) => (
        <details key={`${i}-${item.question}`} className={`group ${card} p-0 [&_summary::-webkit-details-marker]:hidden`}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 font-semibold text-fg">
            {item.question}
            {/* Plus closed, minus open. */}
            <Plus aria-hidden="true" className="size-5 shrink-0 text-maize group-open:hidden" />
            <Minus aria-hidden="true" className="hidden size-5 shrink-0 text-maize group-open:block" />
          </summary>
          <p className="px-5 pb-5 text-fg-2">
            <WithEventsLink text={item.answer} />
          </p>
        </details>
      ))}
    </div>
  );
}

/** Answers are plain text (officer-edited): "Events page" in them links to /events. */
function WithEventsLink({ text }: { text: string }) {
  const parts = text.split("Events page");
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <Link href="/events" className="font-semibold text-maize hover:underline">
          Events page
        </Link>
      )}
      {part}
    </Fragment>
  ));
}

/** The Featured panel on the home page. */
export function FeaturedPanel({ featured }: { featured: FeaturedPanelContent }) {
  const linkClass = "mt-auto inline-flex min-h-11 items-center gap-1 self-start pt-6 text-sm font-semibold text-maize hover:underline";
  const href = featured.link_href;
  return (
    <section className={`relative flex flex-col overflow-hidden ${card} p-6`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgb(240_196_19/0.16),transparent_55%)]" />
      {!art.featured && (
        <CubeCluster
          className="absolute -right-4 -bottom-4 h-36 opacity-70"
          viewBox="0 0 160 140"
          cubes={[
            { x: 110, y: 30, s: 34, tone: "maize" },
            { x: 66, y: 62, s: 28, tone: "blue" },
            { x: 130, y: 82, s: 22, tone: "navy" },
          ]}
        />
      )}
      <div className="relative flex flex-1 flex-col">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-maize">
          <Sparkles aria-hidden="true" className="size-4" />
          Featured
        </p>
        {art.featured ? (
          <FeaturedArt className="mt-4" />
        ) : (
          <Trophy aria-hidden="true" className="mt-5 size-12 text-maize" strokeWidth={1.5} />
        )}
        <h2 className="mt-3 text-2xl leading-tight text-fg">{featured.title}</h2>
        <p className="mt-3 text-fg-2">{featured.body}</p>
        {featured.link_text && href &&
          (href.startsWith("/") ? (
            <Link href={href} className={linkClass}>
              {featured.link_text} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {featured.link_text} <ArrowRight aria-hidden="true" className="size-4" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ))}
      </div>
    </section>
  );
}
