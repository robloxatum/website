import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyStateArt } from "@/components/art/Art";
import { card } from "./styles";

export type Stat = { value: string; label: string; icon: LucideIcon };

const lgCols: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/** The horizontal stats bar from the home mockup. */
export function StatsBar({ stats, className = "" }: { stats: Stat[]; className?: string }) {
  if (stats.length === 0) return null;
  return (
    <dl
      className={`grid grid-cols-2 gap-px [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1 overflow-hidden rounded-2xl border border-line/70 bg-line/60 shadow-card ${lgCols[Math.min(stats.length, 4)]} ${className}`}
    >
      {stats.map(({ value, label, icon: Icon }) => (
        <div key={label} className="flex items-center gap-3 bg-surface px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
          <Icon aria-hidden="true" className="size-8 shrink-0 text-maize sm:size-10" strokeWidth={1.75} />
          {/* Value first visually, label first in the markup (dt before dd). */}
          <div className="flex min-w-0 flex-col-reverse">
            <dt className="mt-1 text-xs leading-snug text-fg-2 sm:text-sm">{label}</dt>
            <dd className="font-display text-2xl leading-none font-extrabold text-fg sm:text-3xl">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center px-6 py-8 text-center ${className}`}>
      <EmptyStateArt className="h-32 w-auto sm:h-40" />
      <h3 className="mt-4 text-xl text-fg sm:text-2xl">{title}</h3>
      {children && <div className="mt-2 max-w-md text-fg-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A titled panel (card with a header row), e.g. "Upcoming Events · View all". */
export function Panel({
  title,
  icon: Icon,
  action,
  children,
  className = "",
  headingLevel = "h2",
}: {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <section className={`${card} p-4 sm:p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Heading className="flex items-center gap-2.5 text-xl text-fg sm:text-2xl">
          {Icon && <Icon aria-hidden="true" className="size-6 text-maize" strokeWidth={2} />}
          {title}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  );
}
