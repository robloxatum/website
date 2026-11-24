"use client";

import { CalendarPlus, ChevronDown, Download } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { button } from "@/components/ui/styles";
import { type CalendarEvent, googleCalendarUrl } from "@/lib/calendar";

/** Google icon-free mark (we don't ship third-party logos). */
function Dot({ className }: { className: string }) {
  return <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${className}`} />;
}

/**
 * "Add to calendar" with two options: Google Calendar (prefilled template
 * link) and Apple/Outlook (.ics download from /events/<id>/calendar.ics).
 * Callers hide it once the event is over.
 */
export function AddToCalendar({
  event,
  variant = "secondary",
  full = false,
}: {
  event: CalendarEvent;
  variant?: "primary" | "secondary";
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  // Absolute link for the calendar entry's details. The menu only renders after
  // a click (never on the server), so window is available here.
  const eventUrl = open ? `${window.location.origin}/events/${event.id}` : "";

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left font-semibold text-fg transition-colors duration-150 hover:bg-white/[0.06] focus-visible:bg-white/[0.06]";

  return (
    <div ref={wrapRef} className={`relative ${full ? "w-full" : ""}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={button({ variant, size: "lg", full })}
      >
        <CalendarPlus aria-hidden="true" />
        Add to calendar
        <ChevronDown aria-hidden="true" className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute top-full left-0 z-30 mt-2 w-full min-w-64 rounded-xl border border-line bg-elevated p-1.5 shadow-card"
        >
          <a
            href={googleCalendarUrl(event, eventUrl)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={item}
          >
            <Dot className="bg-[#4285f4]" />
            Google Calendar
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <a href={`/events/${event.id}/calendar.ics`} download onClick={() => setOpen(false)} className={item}>
            <Download aria-hidden="true" className="size-4 shrink-0 text-fg-2" />
            Apple / Outlook (.ics)
          </a>
        </div>
      )}
    </div>
  );
}
