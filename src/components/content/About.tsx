import { card } from "@/components/ui/styles";
import type { Milestone } from "@/lib/site-content";
import { LinkedInIcon } from "@/components/BrandIcons";
import { FounderAvatar } from "./FounderAvatar";

/**
 * About page blocks. Plain components (no data loading) so /about and the
 * officer preview render exactly the same thing.
 */

export function AboutStory({ story }: { story: string }) {
  return <p className="text-lg leading-relaxed text-fg-2 sm:text-xl">{story}</p>;
}

/** Milestones, top to bottom, on a line with a dot per item. */
export function Timeline({ items }: { items: Milestone[] }) {
  return (
    <ol className="relative mt-6 space-y-8 border-l-2 border-line/70 pl-6 sm:pl-8">
      {items.map((m, i) => (
        <li key={`${i}-${m.title}`} className="relative">
          <span
            aria-hidden="true"
            className="absolute top-1 -left-[calc(1.5rem+7px)] size-3 rounded-full bg-maize ring-4 ring-bg sm:-left-[calc(2rem+7px)]"
          />
          <p className="text-sm font-semibold tracking-[0.12em] text-maize uppercase">{m.date_label}</p>
          <h3 className="mt-1 text-lg text-fg">{m.title}</h3>
          {m.body && <p className="mt-1 text-fg-2">{m.body}</p>}
        </li>
      ))}
    </ol>
  );
}

export type FounderCardData = { name: string; role: string; blurb: string; avatar: string | null; linkedin: string | null };

/** Founders: full-body Roblox avatar (or initials), name, role, LinkedIn (if any) and one-liner. */
export function FoundersGrid({ people }: { people: FounderCardData[] }) {
  return (
    <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {people.map((p, i) => (
        <li key={`${i}-${p.name}`} className={`${card} flex flex-col overflow-hidden`}>
          <FounderAvatar name={p.name} src={p.avatar} />
          <div className="flex flex-1 flex-col p-3 sm:p-4">
            <h3 className="text-base break-words text-fg sm:text-lg">{p.name}</h3>
            <p className="mt-0.5 text-sm font-semibold text-maize">{p.role}</p>
            {p.linkedin && (
              // 44px tap target; pulled left so the icon lines up with the text above.
              <a
                href={p.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${p.name} on LinkedIn`}
                title={`${p.name} on LinkedIn`}
                className="-ml-3 grid size-11 shrink-0 place-items-center self-start rounded-lg text-fg-2 transition-colors duration-150 hover:bg-white/[0.06] hover:text-maize"
              >
                <LinkedInIcon className="size-5" />
              </a>
            )}
            {p.blurb && <p className="mt-2 text-sm break-words text-fg-2">{p.blurb}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
