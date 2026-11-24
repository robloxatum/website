"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { CubeIcon } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import type { CheckinFlags } from "@/app/(site)/officer/actions";
import { statusText, useCheckinFlags } from "@/app/(site)/officer/_components/CheckinControls";

export function PresentClient({
  eventId,
  title,
  code,
  checkinUrl,
  initialCount,
  initialFlags,
}: {
  eventId: string;
  title: string;
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

  // QR code that opens /checkin?code=XXXXX on the public site.
  useEffect(() => {
    QRCode.toString(checkinUrl, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#00274c", light: "#ffffff" },
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

  return (
    <div className="flex min-h-dvh flex-col p-4 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CubeIcon className="size-10" />
          <span className="font-display text-xl text-maize sm:text-2xl">Roblox at UM</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-white btn-sm"
            onClick={() =>
              document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
            }
          >
            Fullscreen
          </button>
          <Link href={`/officer/events/${eventId}`} className="btn btn-white btn-sm">
            Exit
          </Link>
        </div>
      </div>

      <h1 className="mt-4 text-center text-3xl leading-tight text-white sm:text-5xl">{title}</h1>

      <div className="mt-6 grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* QR */}
        <div className="relative mx-auto w-full max-w-[min(80vh,640px)]">
          <div className={`block-card aspect-square bg-white p-4 transition-opacity ${isOpen ? "" : "opacity-20"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local data: URL */}
            {qr && <img src={qr} alt={`QR code for ${checkinUrl}`} className="size-full [image-rendering:pixelated]" />}
          </div>
          {!isOpen && (
            <div className="absolute inset-0 grid place-items-center">
              <p className="block-card bg-maize px-6 py-4 font-display text-3xl text-blue sm:text-4xl">
                Check-in closed
              </p>
            </div>
          )}
        </div>

        {/* Code + count */}
        <div className="flex flex-col items-center gap-8 text-center">
          <div>
            <p className="font-display text-lg uppercase text-sky sm:text-2xl">Scan, or go to</p>
            <p className="font-display text-xl break-all text-white sm:text-3xl">
              {checkinUrl.replace(/^https?:\/\//, "").replace(/\?code=.*$/, "")}
            </p>
            <p className="mt-2 font-display text-lg uppercase text-sky sm:text-2xl">and enter</p>
          </div>
          <div className="flex gap-2 sm:gap-3" aria-label={`Code ${code.split("").join(" ")}`}>
            {code.split("").map((ch, i) => (
              <span
                key={i}
                className="grid size-16 place-items-center border-4 border-blue bg-maize font-display text-5xl text-blue sm:size-24 sm:text-7xl xl:size-32 xl:text-8xl"
                style={{ boxShadow: "0 8px 0 0 #000d1a" }}
              >
                {ch}
              </span>
            ))}
          </div>

          <div>
            <p
              key={bump}
              className="animate-pop font-display text-7xl leading-none text-maize sm:text-9xl"
              aria-live="polite"
            >
              {count}
            </p>
            <p className="font-display text-xl uppercase text-white sm:text-2xl">checked in</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className={`tag ${isOpen ? "bg-grass text-white" : "bg-white text-blue"}`}>
              {statusText(flags, isOpen, ended)}
            </p>
            <button
              type="button"
              onClick={toggle}
              disabled={pending}
              className={`btn ${isOpen ? "btn-white" : "btn-maize"}`}
            >
              {pending ? "…" : isOpen ? "Close check-in" : ended ? "Reopen check-in" : "Open check-in"}
            </button>
            {error && <p role="alert" className="font-semibold text-maize">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
