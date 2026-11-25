"use client";

import { CircleCheck, Hand, LogIn } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { button } from "@/components/ui/styles";
import type { CalendarEvent } from "@/lib/calendar";
import { loadClient } from "@/lib/supabase/client-lazy";

type State =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "ready"; userId: string; going: boolean; justJoined: boolean };

/**
 * "I'm going" toggle for an upcoming or live event. Private: only the member's
 * own RSVP is read or written (RLS), and no counts or names are shown. Signed
 * out, it sends people to sign in and back to this event. RSVP never affects
 * check-in. Callers hide it once the event is over.
 */
export function RsvpToggle({ event, className = "" }: { event: CalendarEvent; className?: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = await loadClient();
      const { data: auth } = await supabase.auth.getClaims();
      const userId = auth?.claims?.sub;
      if (cancelled) return;
      if (!userId) return setState({ kind: "signed-out" });
      const { data } = await supabase
        .from("event_rsvps")
        .select("event_id")
        .eq("event_id", event.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!cancelled) setState({ kind: "ready", userId, going: !!data, justJoined: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  async function toggle() {
    if (state.kind !== "ready" || busy) return;
    setBusy(true);
    setError(null);
    const supabase = await loadClient();
    const { error: err } = state.going
      ? await supabase.from("event_rsvps").delete().eq("event_id", event.id).eq("user_id", state.userId)
      : await supabase.from("event_rsvps").upsert({ event_id: event.id }, { onConflict: "event_id,user_id", ignoreDuplicates: true });
    setBusy(false);
    if (err) {
      setError(
        err.code === "42501"
          ? "RSVP is closed for this event."
          : "Couldn't save your RSVP. Check your connection and try again.",
      );
      return;
    }
    setState({ ...state, going: !state.going, justJoined: !state.going });
  }

  if (state.kind === "signed-out") {
    return (
      <div className={className}>
        <Link
          href={`/login?next=${encodeURIComponent(`/events/${event.id}`)}`}
          className={button({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}
        >
          <LogIn aria-hidden="true" />
          Sign in to RSVP
        </Link>
      </div>
    );
  }

  const going = state.kind === "ready" && state.going;
  return (
    <div className={`space-y-3 ${className}`}>
      <button
        type="button"
        aria-pressed={going}
        disabled={state.kind === "loading" || busy}
        onClick={toggle}
        className={button({
          variant: going ? "primary" : "secondary",
          size: "lg",
          // Full width on phones, like the other event-page buttons.
          className: `w-full sm:w-auto ${state.kind === "loading" ? "opacity-60" : ""}`,
        })}
      >
        {going ? <CircleCheck aria-hidden="true" /> : <Hand aria-hidden="true" />}
        I&rsquo;m going
      </button>
      <div aria-live="polite">
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        {state.kind === "ready" && state.going && (
          <p className="text-sm text-fg-2">
            {state.justJoined ? "You're on the list. " : "You said you're going. "}
            Only officers can see RSVPs. Tap again to undo.
          </p>
        )}
      </div>
    </div>
  );
}
