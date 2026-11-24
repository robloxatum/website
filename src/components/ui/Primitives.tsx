import { Check, Circle, Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import { categoryInfo } from "@/lib/categories";
import type { EventStatus } from "@/lib/types";

/** Uppercase section label with a short rule, e.g. "UNIVERSITY OF MICHIGAN ——". */
export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-3 text-xs font-semibold tracking-[0.22em] text-fg-2 uppercase ${className}`}>
      {children}
      <span aria-hidden="true" className="h-px w-12 bg-linear-to-r from-fg-3/70 to-transparent" />
    </p>
  );
}

export function PageHeader({
  label,
  title,
  description,
  actions,
}: {
  label?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {label && <SectionLabel className="mb-3">{label}</SectionLabel>}
        <h1 className="text-3xl leading-tight text-fg sm:text-4xl lg:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function CategoryBadge({ category, className = "" }: { category: string; className?: string }) {
  const { label } = categoryInfo(category);
  return (
    <span
      className={`inline-flex items-center rounded-md bg-maize px-2 py-0.5 text-[11px] font-bold tracking-wider text-navy uppercase ${className}`}
    >
      {label}
    </span>
  );
}

const statusStyles: Record<EventStatus, { label: string; className: string; icon: ReactNode }> = {
  upcoming: {
    label: "Upcoming",
    className: "border-maize/40 bg-maize/10 text-maize",
    icon: <Clock3 aria-hidden="true" className="size-3.5" />,
  },
  live: {
    label: "Live now",
    className: "border-ok/50 bg-ok/10 text-ok",
    icon: <Circle aria-hidden="true" className="size-2.5 animate-pulse fill-current" />,
  },
  completed: {
    label: "Completed",
    className: "border-ok/25 bg-ok/[0.07] text-ok",
    icon: <Check aria-hidden="true" className="size-3.5" />,
  },
};

export function StatusPill({ status }: { status: EventStatus }) {
  const s = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.className}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-surface/70 ${className}`} />;
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2.5 w-full overflow-hidden rounded-full bg-elevated"
    >
      <div
        className="h-full rounded-full bg-maize transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
