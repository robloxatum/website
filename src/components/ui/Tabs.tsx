"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type Tab = { id: string; label: string; count?: number; content: ReactNode };

/**
 * Segmented tabs (Upcoming / Past / All) with a sliding maize indicator.
 * Panels are rendered on the server and only switched here; arrow keys move
 * between tabs (WAI-ARIA tabs pattern).
 */
export function Tabs({ tabs, initial, label }: { tabs: Tab[]; initial?: string; label: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  function onKey(e: React.KeyboardEvent, index: number) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (index + dir + tabs.length) % tabs.length;
    setActive(tabs[next].id);
    listRef.current?.querySelector<HTMLElement>(`[data-tab="${tabs[next].id}"]`)?.focus();
  }

  return (
    <div>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        className="relative grid w-full max-w-md grid-flow-col auto-cols-fr rounded-xl border border-line/70 bg-bg-2 p-1"
      >
        {indicator && (
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 rounded-lg bg-maize transition-[left,width] duration-200 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
        )}
        {tabs.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`relative z-10 min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors duration-200 ${
                selected ? "text-navy" : "text-fg-2 hover:text-fg"
              } ${!indicator && selected ? "bg-maize" : ""}`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-1.5 tabular-nums ${selected ? "text-navy/70" : "text-fg-3"}`}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="mt-6 rounded-2xl focus-visible:outline-offset-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
