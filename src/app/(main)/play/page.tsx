import { Gamepad2, LogIn, QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JoinGamePanel } from "@/components/events/JoinGame";
import { Skeleton } from "@/components/ui/Primitives";
import { button, card, container } from "@/components/ui/styles";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Play",
  description: "Join the game at a Roblox at UM event you're checked in to.",
};

/**
 * Short link shown on the projector ("On your laptop: <site>/play"): the Join
 * button for the event you're checked in to right now, live-updating.
 */
export default function PlayPage() {
  return (
    <div className={`${container} max-w-md! pt-10`}>
      <p className="flex items-center gap-2 text-sm font-semibold tracking-[0.18em] text-fg-2 uppercase">
        <Gamepad2 aria-hidden="true" className="size-5 text-maize" />
        Play
      </p>
      <h1 className="mt-2 text-4xl text-fg">Join the game</h1>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-48" />}>
          <PlayContent />
        </Suspense>
      </div>
    </div>
  );
}

type CheckedInEvent = { events: { id: string; title: string; starts_at: string; ends_at: string } | null };

async function PlayContent() {
  const profile = await getProfile(); // request-time (reads the session)
  if (!profile) {
    return (
      <NeedCheckin
        body="Sign in with your umich.edu account and check in at the event. The Join button shows up here once you're checked in."
        action={
          <Link href="/login?next=/play" className={button({ size: "lg", full: true })}>
            <LogIn aria-hidden="true" />
            Sign in
          </Link>
        }
      />
    );
  }

  // Events this member is checked in to that haven't ended (their own rows; RLS).
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance")
    .select("events!inner(id, title, starts_at, ends_at)")
    .eq("user_id", profile.id)
    .gt("events.ends_at", new Date().toISOString())
    .returns<CheckedInEvent[]>();
  const events = (data ?? [])
    .map((r) => r.events)
    .filter((e): e is NonNullable<CheckedInEvent["events"]> => !!e)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  if (events.length === 0) {
    return (
      <NeedCheckin
        body="You need to check in to the event first. Scan the QR code on the screen, or enter the code at /checkin, then come back here."
        action={
          <Link href="/checkin" className={button({ size: "lg", full: true })}>
            <QrCode aria-hidden="true" />
            Check in
          </Link>
        }
      />
    );
  }

  return (
    <ul className="space-y-4">
      {events.map((e) => (
        <li key={e.id} className={`${card} space-y-4 p-5`}>
          <div>
            <p className="font-display text-xl font-bold text-fg">{e.title}</p>
            <p className="text-sm text-fg-2">
              {formatTime(e.starts_at)} – {formatTime(e.ends_at)}
            </p>
          </div>
          <JoinGamePanel eventId={e.id} startsAt={e.starts_at} endsAt={e.ends_at} />
        </li>
      ))}
    </ul>
  );
}

function NeedCheckin({ body, action }: { body: string; action: React.ReactNode }) {
  return (
    <div className={`${card} space-y-5 p-5 sm:p-6`}>
      <p className="text-lg text-fg-2">{body}</p>
      {action}
    </div>
  );
}
