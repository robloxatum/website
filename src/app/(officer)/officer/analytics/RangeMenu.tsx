"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

export type RangeOption = { id: string; label: string; href: string };

/**
 * The date range picker: a plain <details> list of links, so it works before
 * (or without) JavaScript. With JavaScript it also closes on Escape, on a
 * click outside, and once a range is picked.
 */
export function RangeMenu({ options, current }: { options: RangeOption[]; current: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const currentLabel = options.find((o) => o.id === current)?.label ?? options[0]?.label;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = (focus: boolean) => {
      if (!el.open) return;
      el.open = false;
      if (focus) el.querySelector("summary")?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onPointer);
    el.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      el.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className="group relative shrink-0 self-start">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-line/80 bg-bg-2/80 px-3 text-sm font-semibold text-fg transition-colors select-none hover:border-fg-3/60 hover:bg-white/[0.05] [&::-webkit-details-marker]:hidden">
        <span className="sr-only">Date range: </span>
        {currentLabel}
        <ChevronDown aria-hidden="true" className="size-4 text-fg-3 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="absolute left-0 z-20 mt-1.5 w-48 sm:right-0 sm:left-auto overflow-hidden rounded-xl border border-line/80 bg-surface p-1 shadow-lift" aria-label="Date range">
        {options.map((o) => {
          const active = o.id === current;
          return (
            <li key={o.id}>
              <Link
                href={o.href}
                aria-current={active ? "page" : undefined}
                onClick={() => ref.current && (ref.current.open = false)}
                className={`flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 text-sm transition-colors ${
                  active ? "bg-maize/12 font-semibold text-maize" : "text-fg-2 hover:bg-white/[0.06] hover:text-fg"
                }`}
              >
                {o.label}
                {active && <Check aria-hidden="true" className="size-4" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
