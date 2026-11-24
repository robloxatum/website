import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyStateArt } from "@/components/art/Art";
import { card } from "./styles";

export function EmptyState({
  title,
  children,
  action,
  className = "",
  headingLevel = "h3",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** h2 when the empty state sits directly under the page's h1 (no section heading). */
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <div className={`flex flex-col items-center px-6 py-8 text-center ${className}`}>
      <EmptyStateArt className="h-32 w-auto sm:h-40" />
      <Heading className="mt-4 text-xl text-fg sm:text-2xl">{title}</Heading>
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
