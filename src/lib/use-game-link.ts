"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { GameLink } from "./game-links";
import { loadClient } from "./supabase/client-lazy";

export type GameLinkState =
  | { status: "loading" }
  | { status: "waiting" } // nothing posted (or not readable yet, e.g. before the event starts)
  | { status: "live"; link: GameLink }
  | { status: "ended" };

/**
 * One shared Realtime subscription per event. The Supabase client hands back
 * the SAME channel for a repeated topic, so separate subscribers (the nav's
 * Play button and the Join panel on /play, say) must share it: subscribing
 * twice fails, and one unsubscribing would cut the other off.
 */
type Shared = { listeners: Set<() => void>; channel?: RealtimeChannel; removeTimer?: ReturnType<typeof setTimeout> };
const shared = new Map<string, Shared>();

/** Calls onChange when the event's link changes and after each (re)connect. Returns an unsubscribe. */
function listenForChanges(eventId: string, onChange: () => void): () => void {
  let entry = shared.get(eventId);
  if (!entry) {
    const created: Shared = { listeners: new Set() };
    shared.set(eventId, created);
    const notify = () => created.listeners.forEach((fn) => fn());
    void (async () => {
      const supabase = await loadClient();
      if (shared.get(eventId) !== created) return; // removed meanwhile
      const channel = supabase.channel(`game:${eventId}`, { config: { private: true } });
      created.channel = channel;
      await supabase.realtime.setAuth(); // private channels authorize with the user's JWT
      if (shared.get(eventId) !== created) return void supabase.removeChannel(channel);
      channel
        .on("broadcast", { event: "changed" }, notify)
        .subscribe((status) => {
          if (status === "SUBSCRIBED") notify(); // catch up after (re)connecting
        });
    })();
    entry = created;
  }
  const current = entry;
  clearTimeout(current.removeTimer);
  current.listeners.add(onChange);
  return () => {
    current.listeners.delete(onChange);
    if (current.listeners.size > 0) return;
    // Short grace period so a quick unmount/remount (navigation, Strict Mode) reuses it.
    current.removeTimer = setTimeout(() => {
      if (current.listeners.size > 0 || shared.get(eventId) !== current) return;
      shared.delete(eventId);
      const channel = current.channel;
      if (channel) void loadClient().then((supabase) => supabase.removeChannel(channel));
    }, 1000);
  };
}

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
    const client = loadClient();
    let cancelled = false;

    async function refetch() {
      if (cancelled) return;
      if (Date.now() >= endMs) return setState({ status: "ended" });
      const supabase = await client;
      if (cancelled) return;
      const { data, error } = await supabase
        .from("event_game_links")
        .select(withUrl ? "url, label" : "event_id")
        .eq("event_id", eventId)
        .maybeSingle<Partial<GameLink>>();
      if (cancelled) return;
      if (error) return; // keep what we have; the poll tries again
      setState(data ? { status: "live", link: { url: data.url ?? "", label: data.label ?? null } } : { status: "waiting" });
    }

    const unlisten = listenForChanges(eventId, () => void refetch());
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
      unlisten();
    };
  }, [eventId, startsAt, endsAt, withUrl]);

  return state;
}
