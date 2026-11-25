"use client";

import { Gamepad2, Hourglass } from "lucide-react";
import { useEffect, useState } from "react";
import { button } from "@/components/ui/styles";
import { loadClient } from "@/lib/supabase/client-lazy";
import { useGameLink } from "@/lib/use-game-link";

type EventTimes = { eventId: string; startsAt: string; endsAt: string };

/**
 * "Join the game" for a member checked in to the event. Live-updates when an
 * officer posts, replaces or clears the link; says it's waiting until then;
 * disappears when the event ends.
 */
export function JoinGamePanel({ eventId, startsAt, endsAt, className = "" }: EventTimes & { className?: string }) {
  const state = useGameLink(eventId, startsAt, endsAt);
  if (state.status === "ended") return null;

  return (
    <div aria-live="polite" className={className}>
      {state.status === "live" ? (
        <div className="space-y-2">
          <a
            href={state.link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={button({ size: "lg", full: true, className: "animate-pop" })}
          >
            <Gamepad2 aria-hidden="true" />
            Join the game
          </a>
          {state.link.label && <p className="text-center text-sm text-fg-2">{state.link.label}</p>}
          <p className="text-center text-xs text-fg-3">Opens Roblox. Only share it with people at the event.</p>
        </div>
      ) : (
        <p
          className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-bg-2/60 px-4 py-3 text-sm font-semibold text-fg-2 ${
            state.status === "loading" ? "opacity-60" : ""
          }`}
        >
          <Hourglass aria-hidden="true" className="size-4 animate-pulse text-maize" />
          Waiting for the game link…
        </p>
      )}
    </div>
  );
}

/**
 * Event page version: shows the panel only to a signed-in member who is
 * checked in to this event (their own attendance row; RLS), so the public,
 * cached event page stays the same for everyone else.
 */
export function JoinGameIfCheckedIn({ eventId, startsAt, endsAt, className = "" }: EventTimes & { className?: string }) {
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    if (Date.now() >= new Date(endsAt).getTime()) return;
    let cancelled = false;
    void (async () => {
      const supabase = await loadClient();
      const { data: auth } = await supabase.auth.getClaims();
      const userId = auth?.claims?.sub;
      if (!userId || cancelled) return;
      const { data } = await supabase
        .from("attendance")
        .select("event_id")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!cancelled) setCheckedIn(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, endsAt]);

  if (!checkedIn) return null;
  return (
    <section aria-labelledby={`game-${eventId}`} className={className}>
      <h2 id={`game-${eventId}`} className="mb-3 text-xl text-fg">
        Play with us
      </h2>
      <JoinGamePanel eventId={eventId} startsAt={startsAt} endsAt={endsAt} />
    </section>
  );
}
