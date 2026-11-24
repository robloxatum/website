"use client";

import { useEffect, useState } from "react";
import type { GameLink } from "./game-links";
import { createClient } from "./supabase/client";

export type GameLinkState =
  | { status: "loading" }
  | { status: "waiting" } // nothing posted (or not readable yet, e.g. before the event starts)
  | { status: "live"; link: GameLink }
  | { status: "ended" };

/** Longest single setTimeout browsers allow (~24.8 days); anything later is just "not now". */
const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * The event's live game link, kept up to date:
 * - a database trigger sends an EMPTY "changed" message on the private
 *   Realtime topic game:<event id> (officers and checked-in members may
 *   listen); we then re-read the link through RLS, which only returns it to
 *   officers or to members checked in while the event is live;
 * - re-check when the event starts and hide it when it ends;
 * - a slow poll and a refetch on focus cover a dropped socket.
 */
export function useGameLink(
  eventId: string,
  startsAt: string,
  endsAt: string,
  /** false: only find out WHETHER a link is posted (the projector never loads the link itself). */
  withUrl = true,
): GameLinkState {
  const [state, setState] = useState<GameLinkState>(() =>
    Date.now() >= new Date(endsAt).getTime() ? { status: "ended" } : { status: "loading" },
  );

  useEffect(() => {
    const endMs = new Date(endsAt).getTime();
    if (Date.now() >= endMs) return; // already "ended" (initial state)
    const supabase = createClient();
    let cancelled = false;

    async function refetch() {
      if (cancelled) return;
      if (Date.now() >= endMs) return setState({ status: "ended" });
      const { data, error } = await supabase
        .from("event_game_links")
        .select(withUrl ? "url, label" : "event_id")
        .eq("event_id", eventId)
        .maybeSingle<Partial<GameLink>>();
      if (cancelled) return;
      if (error) return; // keep what we have; the poll tries again
      setState(data ? { status: "live", link: { url: data.url ?? "", label: data.label ?? null } } : { status: "waiting" });
    }

    const channel = supabase.channel(`game:${eventId}`, { config: { private: true } });
    void (async () => {
      await supabase.realtime.setAuth(); // private channels authorize with the user's JWT
      if (cancelled) return;
      channel
        .on("broadcast", { event: "changed" }, () => void refetch())
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void refetch(); // catch up after (re)connecting
        });
    })();
    void refetch();

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (iso: string, fn: () => void) => {
      const ms = new Date(iso).getTime() - Date.now();
      if (ms > 0 && ms < MAX_TIMEOUT) timers.push(setTimeout(fn, ms + 500));
    };
    at(startsAt, () => void refetch()); // links become readable when the event goes live
    at(endsAt, () => setState({ status: "ended" }));

    const poll = setInterval(() => void refetch(), 30000);
    const onFocus = () => document.visibilityState === "visible" && void refetch();
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [eventId, startsAt, endsAt, withUrl]);

  return state;
}
