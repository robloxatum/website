"use client";

import { Lock, LockOpen } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { button } from "@/components/ui/styles";
import { isCheckinOpen } from "@/lib/checkin-state";
import { formatTime } from "@/lib/time";
import { setCheckinOpen, type CheckinFlags } from "../actions";

export function useCheckinFlags(eventId: string, initial: CheckinFlags) {
  const [flags, setFlags] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Re-evaluate every few seconds so auto-close at the end time shows up live.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const isOpen = isCheckinOpen(flags, now);
  const ended = now >= new Date(flags.ends_at).getTime();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setCheckinOpen(eventId, !isOpen);
      if (res.error) setError(res.error);
      else if (res.flags) setFlags(res.flags);
    });
  }

  return { flags, setFlags, isOpen, ended, pending, error, toggle };
}

export function statusText(flags: CheckinFlags, isOpen: boolean, ended: boolean) {
  if (!isOpen) return ended && flags.checkin_open ? "Closed (event ended)" : "Closed";
  return flags.checkin_reopened ? "Open until you close it" : `Open · closes ${formatTime(flags.ends_at)}`;
}

export function StatusBadge({ isOpen, label }: { isOpen: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isOpen ? "border-ok/50 bg-ok/10 text-ok" : "border-line bg-bg-2 text-fg-2"
      }`}
    >
      <span className={`size-2 rounded-full ${isOpen ? "animate-pulse bg-ok" : "bg-fg-3"}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function CheckinToggle({ eventId, initial }: { eventId: string; initial: CheckinFlags }) {
  const { flags, isOpen, ended, pending, error, toggle } = useCheckinFlags(eventId, initial);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge isOpen={isOpen} label={statusText(flags, isOpen, ended)} />
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={button({ variant: isOpen ? "secondary" : "primary", size: "sm" })}
      >
        {isOpen ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
        {pending ? "…" : isOpen ? "Close check-in" : ended ? "Reopen check-in" : "Open check-in"}
      </button>
      {error && <span role="alert" className="text-sm font-semibold text-bad">{error}</span>}
    </div>
  );
}
