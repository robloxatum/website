"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CODE_PATTERN } from "@/lib/checkin-state";
import type { CheckinResult, CheckinStatus } from "@/lib/types";
import { checkIn } from "./actions";

type Screen = { emoji: string; title: string; body: string; tone: string; retry: boolean };

function screenFor(result: CheckinResult, firstName: string): Screen {
  const event = result.event_title ?? "this event";
  const screens: Record<CheckinStatus, Screen> = {
    ok: { emoji: "✅", title: "You're checked in!", body: `${event}. Have fun, ${firstName}!`, tone: "bg-grass text-white", retry: false },
    already_checked_in: { emoji: "👍", title: "Already checked in", body: `You're already on the list for ${event}.`, tone: "bg-sky", retry: false },
    closed: { emoji: "🔒", title: "Check-in is closed", body: `Check-in for ${event} isn't open right now. Ask an officer if you think this is a mistake.`, tone: "bg-maize", retry: true },
    invalid_code: { emoji: "❌", title: "That code didn't work", body: "Double-check the code on the screen. Codes are 5 letters and never use I or O.", tone: "bg-brick text-white", retry: true },
    rate_limited: { emoji: "⏳", title: "Too many tries", body: "Wait about 10 minutes and try again, or ask an officer to help.", tone: "bg-brick text-white", retry: false },
    not_signed_in: { emoji: "🔑", title: "Please sign in", body: "Your session ended. Sign in again to check in.", tone: "bg-maize", retry: false },
    not_umich: { emoji: "🚫", title: "umich.edu accounts only", body: "Sign out and sign in with your umich.edu Google account.", tone: "bg-brick text-white", retry: false },
    no_profile: { emoji: "🧱", title: "Profile not found", body: "Sign out and back in to finish setting up your profile.", tone: "bg-brick text-white", retry: false },
    error: { emoji: "⚠️", title: "Something went wrong", body: "We couldn't reach the server. Check your connection and try again.", tone: "bg-brick text-white", retry: true },
  };
  return screens[result.status] ?? screens.error;
}

export function CheckinClient({ initialCode, firstName }: { initialCode: string; firstName: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [pending, startTransition] = useTransition();
  const autoSubmitted = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(value: string) {
    startTransition(async () => {
      const res = await checkIn(value);
      if (res.status === "not_signed_in") {
        router.push(`/login?next=${encodeURIComponent(`/checkin?code=${value}`)}`);
        return;
      }
      setResult(res);
      // Drop ?code= so a refresh doesn't resubmit it.
      if (window.location.search) router.replace("/checkin", { scroll: false });
    });
  }

  // Opened from a QR code: check in right away (once).
  useEffect(() => {
    if (autoSubmitted.current || !CODE_PATTERN.test(initialCode)) return;
    autoSubmitted.current = true;
    submit(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  function onChange(raw: string) {
    const next = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
    setCode(next);
    if (CODE_PATTERN.test(next) && !pending) submit(next);
  }

  if (result) {
    const s = screenFor(result, firstName);
    return (
      <div className="space-y-4">
        <div className={`block-card animate-pop p-6 text-center ${s.tone}`} role="status" aria-live="polite">
          <div className="text-7xl" aria-hidden="true">
            {s.emoji}
          </div>
          <h1 className="mt-3 text-3xl leading-tight">{s.title}</h1>
          <p className="mt-2 text-lg">{s.body}</p>
        </div>
        {s.retry ? (
          <button
            type="button"
            className="btn btn-maize w-full"
            onClick={() => {
              setResult(null);
              setCode("");
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            Try another code
          </button>
        ) : (
          <Link href="/events" className="btn btn-white w-full">
            See upcoming events
          </Link>
        )}
      </div>
    );
  }

  const hasBadLetter = /[IO]/.test(code);
  const autoChecking = pending && CODE_PATTERN.test(initialCode) && code === initialCode;

  return (
    <div className="space-y-5">
      <div>
        <p className="font-display text-sm uppercase text-blue/60">Hey {firstName}!</p>
        <h1 className="text-4xl">Check in</h1>
      </div>

      <form
        className="block-card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (CODE_PATTERN.test(code)) submit(code);
        }}
      >
        <label htmlFor="code" className="label">
          Enter the 5-letter code
        </label>
        <input
          ref={inputRef}
          id="code"
          name="code"
          value={code}
          onChange={(e) => onChange(e.target.value)}
          disabled={pending}
          autoFocus={!initialCode}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="go"
          maxLength={5}
          placeholder="ABCDE"
          aria-describedby="code-help"
          className="field text-center font-display text-5xl tracking-[0.3em] uppercase placeholder:text-blue/15"
        />
        <p id="code-help" className="text-sm text-blue/70">
          {hasBadLetter
            ? "Codes never use the letters I or O. Check the screen again."
            : "It's on the screen at the front of the room. Or scan the QR code."}
        </p>
        <button type="submit" disabled={pending || !CODE_PATTERN.test(code)} className="btn btn-maize w-full text-lg">
          {pending ? (autoChecking ? "Checking you in…" : "Checking…") : "Check in"}
        </button>
      </form>
    </div>
  );
}
