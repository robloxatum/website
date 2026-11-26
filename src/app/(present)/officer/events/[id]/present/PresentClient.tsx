"use client";

import { Lock, LockOpen, Maximize, X } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/Logo";
import { ProgressBar } from "@/components/ui/Primitives";
import { button } from "@/components/ui/styles";
import { createClient } from "@/lib/supabase/client";
import { useGameServers } from "@/lib/use-game-servers";
import { GameServersControl } from "@/app/(officer)/officer/_components/GameServersControl";
import type { CheckinFlags } from "@/app/(officer)/officer/actions";
import { statusText, useCheckinFlags } from "@/app/(officer)/officer/_components/CheckinControls";

export function PresentClient({
  eventId,
  title,
  startsAt,
  capacity,
  code,
  checkinUrl,
  initialCount,
  initialFlags,
}: {
  eventId: string;
  title: string;
  startsAt: string;
  capacity: number | null;
  code: string;
  checkinUrl: string;
  initialCount: number;
  initialFlags: CheckinFlags;
}) {
  const { flags, setFlags, isOpen, ended, pending, error, toggle } = useCheckinFlags(eventId, initialFlags);
  const [count, setCount] = useState(initialCount);
  const countRef = useRef(initialCount);
  const [bump, setBump] = useState(0);
  const [qr, setQr] = useState<string | null>(null);
  // Only HOW MANY game servers are up: this screen is projected, so the links
  // themselves are never loaded or shown here.
  const game = useGameServers(eventId, startsAt, flags.ends_at, false);

  // QR code that opens /checkin?code=XXXXX on the public site.
  useEffect(() => {
    QRCode.toString(checkinUrl, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#081f40", light: "#ffffff" },
    }).then((svg) => setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`));
  }, [checkinUrl]);

  // Live count: a database trigger broadcasts the new count on a private
  // channel that only officers can join (covers check-ins AND removals).
  // A slow poll keeps the count and check-in state right if the socket drops.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    function applyCount(c: number) {
      if (cancelled) return;
      if (c > countRef.current) setBump((b) => b + 1);
      countRef.current = c;
      setCount(c);
    }

    async function refetch() {
      const [{ count: c }, { data: row }] = await Promise.all([
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("events").select("checkin_open, checkin_reopened, ends_at").eq("id", eventId).single<CheckinFlags>(),
      ]);
      if (typeof c === "number") applyCount(c);
      if (row && !cancelled) setFlags(row);
    }

    const channel = supabase.channel(`attendance:${eventId}`, { config: { private: true } });
    void (async () => {
      // Private channels authorize with the user's JWT.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel
        .on("broadcast", { event: "count" }, ({ payload }) => {
          if (typeof payload?.count === "number") applyCount(payload.count);
        })
        .subscribe((status) => {
          // Catch up on anything missed while (re)connecting.
          if (status === "SUBSCRIBED") void refetch();
        });
    })();

    const poll = setInterval(() => void refetch(), 15000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [eventId, setFlags]);

  // Keep the projector laptop's screen awake.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = () =>
      navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);

  const host = checkinUrl.replace(/^https?:\/\//, "").replace(/\?code=.*$/, "");

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-bg p-4 sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#123a5f_0%,transparent_60%)]" />
      <div className="relative flex items-center justify-between gap-3">
        <Wordmark tone="white" className="h-8 w-auto sm:h-11" />
        <div className="flex gap-2">
          <button
            type="button"
            className={button({ variant: "secondary", size: "sm" })}
            onClick={() =>
              document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
            }
          >
            <Maximize aria-hidden="true" />
            Fullscreen
          </button>
          <Link href={`/officer/events/${eventId}`} className={button({ variant: "secondary", size: "sm" })}>
            <X aria-hidden="true" />
            Exit
          </Link>
        </div>
      </div>

      <h1 className="relative mt-4 text-center text-3xl leading-tight text-fg sm:text-5xl">{title}</h1>

      <div className="relative mt-6 grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* QR */}
        <div className="relative mx-auto w-full max-w-[min(78vh,640px)]">
          <div className={`aspect-square rounded-3xl bg-white p-[4%] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] transition-opacity duration-300 ${isOpen ? "" : "opacity-15"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local data: URL */}
            {qr && <img src={qr} alt={`QR code for ${checkinUrl}`} className="size-full [image-rendering:pixelated]" />}
          </div>
          {!isOpen && (
            <div className="absolute inset-0 grid place-items-center">
              <p className="flex items-center gap-3 rounded-2xl bg-maize px-6 py-4 font-display text-3xl font-extrabold text-navy sm:text-4xl">
                <Lock aria-hidden="true" className="size-8" />
                Check-in closed
              </p>
            </div>
          )}
        </div>

        {/* Code + count */}
        <div className="flex flex-col items-center gap-8 text-center">
          <div>
            <p className="text-lg font-semibold tracking-[0.2em] text-fg-2 uppercase sm:text-2xl">Scan, or go to</p>
            <p className="font-display text-2xl font-bold break-all text-fg sm:text-4xl">{host}</p>
            <p className="mt-2 text-lg font-semibold tracking-[0.2em] text-fg-2 uppercase sm:text-2xl">and enter</p>
          </div>
          <div className="flex gap-2 sm:gap-3" aria-label={`Code ${code.split("").join(" ")}`}>
            {code.split("").map((ch, i) => (
              <span
                key={i}
                className="grid size-16 place-items-center rounded-2xl bg-maize font-display text-5xl font-extrabold text-navy shadow-[0_8px_0_0_#8a6f05] sm:size-24 sm:text-7xl xl:size-28 xl:text-8xl 2xl:size-32"
              >
                {ch}
              </span>
            ))}
          </div>

          <div className="w-full max-w-md">
            <p key={bump} className="animate-pop font-display text-7xl leading-none font-extrabold text-maize sm:text-9xl" aria-live="polite">
              {count}
            </p>
            <p className="mt-1 text-xl font-semibold tracking-[0.15em] text-fg uppercase sm:text-2xl">
              {capacity ? `of ${capacity} checked in` : "checked in"}
            </p>
            {capacity ? (
              <div className="mt-4">
                <ProgressBar value={Math.min(count, capacity)} max={capacity} label={`${count} of ${capacity} checked in`} />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-2">
            <p
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${
                isOpen ? "border-ok/50 bg-ok/10 text-ok" : "border-line bg-bg-2 text-fg-2"
              }`}
            >
              {statusText(flags, isOpen, ended)}
            </p>
            <button type="button" onClick={toggle} disabled={pending} className={button({ variant: isOpen ? "secondary" : "primary" })}>
              {isOpen ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
              {pending ? "…" : isOpen ? "Close check-in" : ended ? "Reopen check-in" : "Open check-in"}
            </button>
            {error && <p role="alert" className="font-semibold text-bad">{error}</p>}
          </div>

          {/* Game servers: a count only, never the links. Hidden once the event is over. */}
          {game.status !== "ended" && (
            <div className="flex w-full max-w-md flex-col items-center gap-3 border-t border-line/60 pt-6">
              <p className="font-display text-xl font-bold text-fg sm:text-2xl">
                On your laptop: <span className="text-maize">{host.replace(/\/checkin$/, "")}/play</span>
              </p>
              <GameServersControl
                eventId={eventId}
                onProjector
                summary={game.status === "live" ? { live: game.servers.length, full: game.servers.filter((s) => s.is_full).length } : null}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
