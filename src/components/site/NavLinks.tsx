"use client";

import { CalendarDays, Gamepad2, Home, Link2, QrCode, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useEffectEvent, useState } from "react";
import { button } from "@/components/ui/styles";
import { CHECK_IN_LEAD_MS, isCheckInTime } from "@/lib/event-day";
import type { CheckedInEvent, MemberNav } from "@/lib/member-nav";
import { useGameServers } from "@/lib/use-game-servers";

export function isActive(pathname: string | null, href: string) {
  if (pathname === null) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The pathname is request data, so on dynamic routes it streams in: the nav
 * prerenders without an active item and lights up as soon as it's known.
 */
export function withPathname(Nav: (props: { pathname: string | null }) => React.ReactNode) {
  return withPathnameProps<{ pathname: string | null }>(Nav);
}

/** Same, for navs that take other props too. */
function withPathnameProps<P extends { pathname: string | null }>(Nav: (props: P) => React.ReactNode) {
  type Props = Omit<P, "pathname">;
  function Live(props: Props) {
    return <Nav {...(props as P)} pathname={usePathname()} />;
  }
  return function NavWithPathname(props: Props) {
    return (
      <Suspense fallback={<Nav {...(props as P)} pathname={null} />}>
        <Live {...props} />
      </Suspense>
    );
  };
}

/* ---------------------------------------------------------------------------
 * Play instead of Check In while the member is checked in to a live event.
 * Only times and "is a link posted?" reach the browser here; the link itself
 * is only ever read on /play (which does the access check).
 * ------------------------------------------------------------------------- */

const MAX_TIMEOUT = 2 ** 31 - 1;

/** When an upcoming event starts and ends (public times only). */
export type CheckInWindow = { starts_at: string; ends_at: string };

function liveAt(events: CheckedInEvent[], now: number) {
  return events.find((e) => Date.parse(e.starts_at) <= now && now < Date.parse(e.ends_at)) ?? null;
}

/**
 * Calls `update` at each of these times (ms) still ahead, and whenever the tab
 * comes back into view (and once on mount if `now`).
 */
function useUpdateAt(times: number[], update: () => void, { now = false } = {}) {
  const onTime = useEffectEvent(update);
  const key = times.join(",");
  useEffect(() => {
    if (now) onTime();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const t of key ? key.split(",").map(Number) : []) {
      const ms = t - Date.now();
      if (ms > 0 && ms < MAX_TIMEOUT) timers.push(setTimeout(onTime, ms + 500));
    }
    const onFocus = () => document.visibilityState === "visible" && onTime();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [key, now]);
}

/** The checked-in event that's live right now, switching when one starts or ends. */
function useLiveEvent(events: CheckedInEvent[]) {
  // No check-ins (always the case in the prerendered shell): no clock needed.
  const [live, setLive] = useState(() => (events.length ? liveAt(events, Date.now()) : null));
  useUpdateAt(
    events.flatMap((e) => [Date.parse(e.starts_at), Date.parse(e.ends_at)]),
    () => setLive(liveAt(events, Date.now())),
  );
  return live;
}

/**
 * Event day: some upcoming event's check-in window (2 hours before the start until the
 * end, as on the event page) is open, switching as windows open and close.
 */
function useEventDay(windows: CheckInWindow[]) {
  // Off in the server HTML and first render, then the browser's clock decides
  // (so server and browser HTML always match).
  const [on, setOn] = useState(false);
  useUpdateAt(
    windows.flatMap((w) => [Date.parse(w.starts_at) - CHECK_IN_LEAD_MS, Date.parse(w.ends_at)]),
    () => setOn(windows.some((w) => isCheckInTime(w))),
    { now: true },
  );
  return on;
}

/** Renders Check In, or Play (with "posted" = a game link is up) during a live checked-in event. */
function CheckInOrPlay({
  events,
  render,
}: {
  events: CheckedInEvent[];
  render: (mode: { play: false } | { play: true; posted: boolean }) => React.ReactNode;
}) {
  const live = useLiveEvent(events);
  if (!live) return render({ play: false });
  return <LivePlay key={live.id} event={live} render={render} />;
}

function LivePlay({
  event,
  render,
}: {
  event: CheckedInEvent;
  render: (mode: { play: true; posted: boolean }) => React.ReactNode;
}) {
  // false: only asks WHETHER a link is posted; the URL is never loaded here.
  const game = useGameServers(event.id, event.starts_at, event.ends_at, false);
  return render({ play: true, posted: game.status === "live" });
}

/** Small pulsing dot: "the game link is up". */
function PostedDot({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute flex size-3 ${className}`}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-75" />
      <span className="relative inline-flex size-3 rounded-full bg-ok ring-2 ring-bg-2" />
    </span>
  );
}

/** A stable key so the live-event timers restart when the server sends new check-ins. */
export function checkInsKey(events: CheckedInEvent[]) {
  return events.map((e) => `${e.id}@${e.starts_at}-${e.ends_at}`).join(",");
}

/** Desktop header button (hidden on phones, which have the tab bar). */
export function HeaderCheckIn({ events, outline = false }: { events: CheckedInEvent[]; outline?: boolean }) {
  return (
    <CheckInOrPlay
      key={checkInsKey(events)}
      events={events}
      render={(mode) =>
        mode.play ? (
          <Link href="/play" className={button({ size: "sm", className: "relative" })}>
            <Gamepad2 aria-hidden="true" />
            Play
            {mode.posted && (
              <>
                <PostedDot className="-top-1 -right-1" />
                <span className="sr-only">(game link posted)</span>
              </>
            )}
          </Link>
        ) : (
          <Link href="/checkin" className={button({ variant: outline ? "secondary" : "primary", size: "sm" })}>
            <QrCode aria-hidden="true" />
            Check In
          </Link>
        )
      }
    />
  );
}

/**
 * Signed out: a plain "Sign in" for returning members and a yellow "Sign up"
 * (the /join page). Neither on /join or /login, which have their own sign-in /
 * sign-up buttons. Those are static routes, so the pathname is known in the
 * first HTML there; on dynamic routes it streams in, and both show meanwhile.
 */
export const SignedOutActions = withPathname(function SignedOutActionsInner({ pathname }: { pathname: string | null }) {
  if (pathname === "/join" || pathname === "/login") return null;
  return (
    // No gap: Sign in's own padding spaces the two.
    <div className="flex items-center">
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center px-2.5 text-sm font-semibold whitespace-nowrap text-fg-2 transition-colors duration-150 hover:text-fg"
      >
        Sign in
      </Link>
      <Link href="/join" className={button({ size: "sm" })}>
        Sign up
      </Link>
    </div>
  );
});

/* ---------------------------------------------------------------------------
 * Desktop header nav. The server renders the signed-out nav (with Join) until
 * the session is known, so nothing shifts for signed-out visitors; Join is
 * last, so for members it drops off without moving the rest.
 * ------------------------------------------------------------------------- */

const navLink = (active: boolean) =>
  `group relative flex items-center px-2.5 lg:px-3 text-[15px] font-semibold transition-colors duration-150 ${
    active ? "text-fg" : "text-fg-2 hover:text-fg"
  }`;

export const DesktopNav = withPathnameProps(function DesktopNavInner({
  pathname,
  member,
}: {
  pathname: string | null;
  member: boolean;
}) {
  const items = [
    { href: "/", label: "Home" },
    { href: "/events", label: "Events" },
    { href: "/links", label: "Links" },
    ...(member ? [] : [{ href: "/join", label: "Join" }]),
  ];
  return (
    <nav aria-label="Main" className="hidden h-full items-stretch gap-1 md:flex">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={navLink(active)}>
            {item.label}
            <span
              aria-hidden="true"
              className={`absolute inset-x-2.5 lg:inset-x-3 bottom-0 h-[3px] origin-center rounded-full bg-maize transition-transform duration-200 ease-out ${
                active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
});

/* ---------------------------------------------------------------------------
 * Phone bottom tab bar (hidden from md up). Renders as signed out (SIGNED_OUT)
 * until the session is known. Slot 3: Check In / Play. Slot 4: Join (signed
 * out) / Links (members).
 * ------------------------------------------------------------------------- */

/** What the nav shows before (or without) a session. */
export const SIGNED_OUT: MemberNav = { member: false, checkedIn: [] };

const tabClass = (active: boolean) =>
  `relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-150 ${
    active ? "text-maize" : "text-fg-2 hover:text-fg"
  }`;

function Tab({ href, label, icon: Icon, pathname }: { href: string; label: string; icon: typeof Home; pathname: string | null }) {
  const active = isActive(pathname, href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
      <Icon aria-hidden="true" className="size-[22px]" />
      {label}
      <span
        aria-hidden="true"
        className={`absolute top-0 h-[3px] w-8 rounded-full bg-maize transition-transform duration-200 ${active ? "scale-x-100" : "scale-x-0"}`}
      />
    </Link>
  );
}

/**
 * The raised middle button. Navy with a yellow icon most days; yellow on event
 * day (`highlight`) and for Play.
 */
function PrimaryTab({
  href,
  label,
  icon: Icon,
  pathname,
  highlight,
  posted = false,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  pathname: string | null;
  highlight: boolean;
  posted?: boolean;
}) {
  const active = isActive(pathname, href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active)} data-highlight={highlight || undefined}>
      <span
        className={`relative -mt-5 grid size-12 place-items-center rounded-2xl transition-colors duration-200 ${
          highlight
            ? "bg-maize text-navy shadow-[0_8px_20px_-8px_rgb(240_196_19/0.7)]"
            : "border border-maize/45 bg-navy text-maize shadow-[0_8px_20px_-10px_rgb(0_0_0/0.8)]"
        }`}
      >
        <Icon aria-hidden="true" className="size-6" />
        {posted && <PostedDot className="-top-1 -right-1" />}
      </span>
      {label}
      {posted && <span className="sr-only">(game link posted)</span>}
    </Link>
  );
}

export const MobileTabBar = withPathnameProps(function MobileTabBarInner({
  pathname,
  nav,
  checkInWindows = [],
}: {
  pathname: string | null;
  nav: MemberNav;
  /** Upcoming events' times: Check In turns yellow on event day. */
  checkInWindows?: CheckInWindow[];
}) {
  const events = nav.checkedIn;
  const eventDay = useEventDay(checkInWindows);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        <li><Tab href="/" label="Home" icon={Home} pathname={pathname} /></li>
        <li><Tab href="/events" label="Events" icon={CalendarDays} pathname={pathname} /></li>
        <li>
          <CheckInOrPlay
            key={checkInsKey(events)}
            events={events}
            render={(mode) =>
              mode.play ? (
                <PrimaryTab href="/play" label="Play" icon={Gamepad2} pathname={pathname} highlight posted={mode.posted} />
              ) : (
                <PrimaryTab href="/checkin" label="Check In" icon={QrCode} pathname={pathname} highlight={eventDay} />
              )
            }
          />
        </li>
        <li>
          {nav.member ? (
            <Tab href="/links" label="Links" icon={Link2} pathname={pathname} />
          ) : (
            <Tab href="/join" label="Join" icon={UserPlus} pathname={pathname} />
          )}
        </li>
        <li><Tab href="/profile" label="Account" icon={UserRound} pathname={pathname} /></li>
      </ul>
    </nav>
  );
});
