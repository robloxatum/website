"use client";

import { Ban, Gamepad2, Hourglass, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { button } from "@/components/ui/styles";
import type { GameServer } from "@/lib/game-links";
import { loadClient } from "@/lib/supabase/client-lazy";
import { useGameServers } from "@/lib/use-game-servers";

type EventTimes = { eventId: string; startsAt: string; endsAt: string };

/**
 * "Join the game" for a member checked in to the event. Live-updates as
 * officers add, edit, reorder, mark full or remove servers; says it's waiting
 * until the first one is up; disappears when the event ends. One server looks
 * like a single Join button; several are a list, with a "Suggested for you"
 * pick that spreads people evenly over the servers that aren't full.
 */
export function JoinGamePanel({ eventId, startsAt, endsAt, className = "" }: EventTimes & { className?: string }) {
  const state = useGameServers(eventId, startsAt, endsAt);
  if (state.status === "ended") return null;

  return (
    <div aria-live="polite" className={className}>
      {state.status === "live" ? (
        <div className="space-y-2">
          {state.servers.length === 1 ? (
            <SingleServer server={state.servers[0]} />
          ) : (
            <ServerList servers={state.servers} suggestedId={state.suggestedId} />
          )}
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

/** Today's look: one big Join button with the label under it. */
function SingleServer({ server }: { server: GameServer }) {
  if (server.is_full) {
    return (
      <>
        <FullButton label="Join the game" />
        <p className="text-center text-sm text-fg-2">
          {server.label}: full right now. Hang tight, an officer will open another server.
        </p>
      </>
    );
  }
  return (
    <>
      <a href={server.url} target="_blank" rel="noopener noreferrer" className={button({ size: "lg", full: true, className: "animate-pop" })}>
        <Gamepad2 aria-hidden="true" />
        Join the game
      </a>
      <p className="text-center text-sm text-fg-2">{server.label}</p>
    </>
  );
}

function FullButton({ label }: { label: string }) {
  return (
    <p
      aria-disabled="true"
      className="flex min-h-13 w-full items-center justify-center gap-2 rounded-[10px] border border-line bg-white/[0.03] px-6 font-semibold text-fg-3"
    >
      <Ban aria-hidden="true" className="size-[1.15em]" />
      {label} <span className="sr-only">(full)</span>
    </p>
  );
}

/** Several servers: one Join button each, in the officers' order; full ones greyed out. */
function ServerList({ servers, suggestedId }: { servers: GameServer[]; suggestedId: string | null }) {
  const anyOpen = servers.some((s) => !s.is_full);
  return (
    <ul className="space-y-2" aria-label="Game servers">
      {servers.map((s) => {
        const suggested = s.id === suggestedId;
        if (s.is_full) {
          return (
            <li key={s.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-line/70 bg-bg-2/40 px-4 py-2.5 opacity-70">
              <Ban aria-hidden="true" className="size-5 shrink-0 text-fg-3" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-fg-2">{s.label}</span>
                <span className="block text-sm text-fg-3">{anyOpen ? "Full — try another" : "Full — hang tight for another server"}</span>
              </span>
            </li>
          );
        }
        return (
          <li key={s.id}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex min-h-14 items-center gap-3 rounded-xl px-4 py-2.5 font-semibold transition-[background-color,border-color,transform] active:translate-y-px ${
                suggested
                  ? "animate-pop bg-maize text-navy shadow-[0_10px_28px_-14px_rgb(240_196_19/0.65)] hover:bg-maize-hover"
                  : "border border-line bg-white/[0.03] text-fg hover:border-fg-3/70 hover:bg-white/[0.07]"
              }`}
            >
              {/* "Join" comes first in the text (its accessible name reads "Join <label>"), last on screen. */}
              <span className="order-last text-sm">Join</span>{" "}
              <Gamepad2 aria-hidden="true" className="size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{s.label}</span>{" "}
                {suggested && (
                  <span className="flex items-center gap-1 text-xs font-bold tracking-wider uppercase opacity-80">
                    <Sparkles aria-hidden="true" className="size-3.5" />
                    Suggested for you
                  </span>
                )}
              </span>
            </a>
          </li>
        );
      })}
      {servers.length > 1 && suggestedId && (
        <li className="pt-1 text-center text-xs text-fg-3">The suggestion spreads people evenly. You can pick any open server.</li>
      )}
    </ul>
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
