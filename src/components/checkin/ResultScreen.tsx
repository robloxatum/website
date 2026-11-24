"use client";

import {
  Ban, CircleAlert, CircleCheckBig, Hourglass, KeyRound, Lock, RotateCcw, ThumbsUp, UserX, XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { EventCover } from "@/components/art/Art";
import { Cube } from "@/components/art/Cubes";
import { JoinGamePanel } from "@/components/events/JoinGame";
import { CategoryBadge } from "@/components/ui/Primitives";
import { button } from "@/components/ui/styles";
import { formatDate, formatTime } from "@/lib/time";
import type { CheckinEvent, CheckinResult, CheckinStatus } from "@/lib/types";

type Screen = { icon: LucideIcon; title: string; body: string; tone: "ok" | "info" | "warn" | "bad"; retry: boolean };

const toneStyles = {
  ok: { bg: "from-[#0d3b33] via-bg to-bg", icon: "bg-ok text-navy", ring: "shadow-[0_0_0_12px_rgb(52_211_153/0.15)]" },
  info: { bg: "from-[#16406a] via-bg to-bg", icon: "bg-maize text-navy", ring: "shadow-[0_0_0_12px_rgb(240_196_19/0.15)]" },
  warn: { bg: "from-[#3d3209] via-bg to-bg", icon: "bg-maize text-navy", ring: "shadow-[0_0_0_12px_rgb(240_196_19/0.15)]" },
  bad: { bg: "from-[#3d1620] via-bg to-bg", icon: "bg-bad text-navy", ring: "shadow-[0_0_0_12px_rgb(248_113_113/0.15)]" },
};

export function screenFor(result: CheckinResult, firstName: string): Screen {
  const event = result.event?.title ?? result.event_title ?? "this event";
  const screens: Record<CheckinStatus, Screen> = {
    ok: { icon: CircleCheckBig, title: "You're checked in!", body: `Have fun, ${firstName}!`, tone: "ok", retry: false },
    already_checked_in: { icon: ThumbsUp, title: "Already checked in", body: `You're already on the list for ${event}.`, tone: "info", retry: false },
    closed: { icon: Lock, title: "Check-in is closed", body: `Check-in for ${event} isn't open right now. Ask an officer if you think this is a mistake.`, tone: "warn", retry: true },
    invalid_code: { icon: XCircle, title: "That code didn't work", body: "Double-check the code on the screen. Codes are 5 letters and never use I or O.", tone: "bad", retry: true },
    rate_limited: { icon: Hourglass, title: "Too many tries", body: "Wait about 10 minutes and try again, or ask an officer to help.", tone: "bad", retry: false },
    not_signed_in: { icon: KeyRound, title: "Please sign in", body: "Your session ended. Sign in again to check in.", tone: "warn", retry: false },
    not_umich: { icon: Ban, title: "umich.edu accounts only", body: "Sign out and sign in with your umich.edu Google account.", tone: "bad", retry: false },
    no_profile: { icon: UserX, title: "Profile not found", body: "Sign out and back in to finish setting up your profile.", tone: "bad", retry: false },
    error: { icon: CircleAlert, title: "Something went wrong", body: "We couldn't reach the server. Check your connection and try again.", tone: "bad", retry: true },
  };
  return screens[result.status] ?? screens.error;
}

/** The event the code belongs to (public details only). */
export function CheckinEventCard({ event }: { event: CheckinEvent }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line/70 bg-surface/90 p-3 text-left">
      <EventCover category={event.category} className="aspect-square w-20 shrink-0 rounded-xl" sizes="80px" />
      <div className="min-w-0">
        <CategoryBadge category={event.category} />
        <p className="mt-1 truncate font-display text-lg font-bold text-fg">{event.title}</p>
        <p className="truncate text-sm text-fg-2">
          {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </div>
    </div>
  );
}

/** Little burst of maize/blue cubes behind the success icon. */
function Burst() {
  const pieces = [
    { x: -110, y: -70, r: -20, tone: "maize" as const, d: 0 },
    { x: 105, y: -80, r: 25, tone: "blue" as const, d: 40 },
    { x: -125, y: 30, r: 15, tone: "sky" as const, d: 80 },
    { x: 120, y: 25, r: -15, tone: "maize" as const, d: 20 },
    { x: -60, y: -120, r: 10, tone: "sky" as const, d: 60 },
    { x: 65, y: -118, r: -10, tone: "maize" as const, d: 100 },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2">
      {pieces.map((p, i) => (
        <svg
          key={i}
          viewBox="-14 0 28 32"
          className="absolute size-7 -translate-x-1/2 -translate-y-1/2 animate-burst"
          style={{ "--bx": `${p.x}px`, "--by": `${p.y}px`, "--br": `${p.r}deg`, animationDelay: `${p.d}ms` } as React.CSSProperties}
        >
          <Cube x={0} y={0} s={14} tone={p.tone} />
        </svg>
      ))}
    </div>
  );
}

/** Full-screen result after a check-in attempt. */
export function ResultScreen({
  result,
  firstName,
  onRetry,
}: {
  result: CheckinResult;
  firstName: string;
  onRetry: () => void;
}) {
  const s = screenFor(result, firstName);
  const t = toneStyles[s.tone];
  const Icon = s.icon;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the result so screen readers announce it and keyboard users land here.
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-result-title"
      className={`fixed inset-0 z-50 flex flex-col overflow-y-auto bg-linear-to-b ${t.bg} px-5 pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]`}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {result.event && <div className="animate-rise"><CheckinEventCard event={result.event} /></div>}

        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="relative">
            {s.tone === "ok" && <Burst />}
            <div className={`relative grid size-28 animate-pop place-items-center rounded-[28px] ${t.icon} ${t.ring}`}>
              <Icon aria-hidden="true" className="size-14" strokeWidth={2.25} />
            </div>
          </div>
          <h1
            ref={headingRef}
            id="checkin-result-title"
            tabIndex={-1}
            className="mt-8 animate-rise text-4xl leading-tight text-fg outline-none sm:text-5xl"
          >
            {s.title}
          </h1>
          <p role="status" className="mt-3 animate-rise text-lg text-fg-2">{s.body}</p>
        </div>

        <div className="space-y-3">
          {/* Checked in: the event's game link, live (hidden once the event ends). */}
          {(result.status === "ok" || result.status === "already_checked_in") && result.event && (
            <JoinGamePanel
              eventId={result.event.id}
              startsAt={result.event.starts_at}
              endsAt={result.event.ends_at}
              className="animate-rise pb-2"
            />
          )}
          {s.retry && (
            <button type="button" onClick={onRetry} className={button({ size: "lg", full: true })}>
              <RotateCcw aria-hidden="true" />
              Try another code
            </button>
          )}
          <Link href="/events" className={button({ variant: s.retry ? "secondary" : "primary", size: "lg", full: true })}>
            See upcoming events
          </Link>
          <Link href="/" className={button({ variant: "ghost", full: true })}>
            Done
          </Link>
        </div>
      </div>
    </div>
  );
}
