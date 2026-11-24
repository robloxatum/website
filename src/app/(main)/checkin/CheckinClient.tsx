"use client";

import { QrCode, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { CodeInput } from "@/components/checkin/CodeInput";
import { ResultScreen } from "@/components/checkin/ResultScreen";
import { button, card } from "@/components/ui/styles";
import { CODE_PATTERN } from "@/lib/checkin-state";
import type { CheckinResult } from "@/lib/types";
import { checkIn } from "./actions";

export function CheckinClient({ initialCode, firstName }: { initialCode: string; firstName: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [pending, startTransition] = useTransition();
  // The code we already auto-submitted from the URL, so it isn't sent twice.
  const autoSubmitted = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Next keeps visited pages mounted but hidden (React Activity). Reset when
  // this page is hidden, so coming back to /checkin starts fresh instead of
  // showing an old result such as "Already checked in".
  useLayoutEffect(() => {
    return () => {
      setResult(null);
      setCode("");
      // Don't clear autoSubmitted here: React Strict Mode runs this cleanup
      // right after mount in dev, which would submit the QR code twice. It is
      // cleared when ?code= leaves the URL (see the effect below).
    };
  }, []);

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

  // Opened from a QR code: check in right away (once per scan).
  useEffect(() => {
    if (!CODE_PATTERN.test(initialCode)) {
      autoSubmitted.current = null; // URL was cleaned up; allow the next scan
      return;
    }
    if (autoSubmitted.current === initialCode) return;
    autoSubmitted.current = initialCode;
    submit(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  function onChange(raw: string) {
    const next = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
    setCode(next);
    if (CODE_PATTERN.test(next) && !pending) submit(next);
  }

  if (result) {
    return (
      <ResultScreen
        result={result}
        firstName={firstName}
        onRetry={() => {
          setResult(null);
          setCode("");
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      />
    );
  }

  const hasBadLetter = /[IO]/.test(code);
  const autoChecking = pending && CODE_PATTERN.test(initialCode) && code === initialCode;

  return (
    <div className="mx-auto max-w-md">
      <p className="text-sm font-semibold text-maize">Hey {firstName}!</p>
      <h1 className="mt-1 text-4xl text-fg">Event Check-In</h1>
      <p className="mt-2 text-fg-2">Scan the QR code in the room, or type the code from the screen.</p>

      <form
        className={`mt-6 ${card} space-y-5 p-5 sm:p-6`}
        onSubmit={(e) => {
          e.preventDefault();
          if (CODE_PATTERN.test(code)) submit(code);
        }}
      >
        <label htmlFor="code" className="flex items-center justify-center gap-2 text-sm font-semibold text-fg">
          <ScanLine aria-hidden="true" className="size-4 text-maize" />
          Enter the 5-letter code
        </label>
        <CodeInput
          ref={inputRef}
          value={code}
          onChange={onChange}
          disabled={pending}
          autoFocus={!initialCode}
          invalid={hasBadLetter}
          describedBy="code-help"
        />
        <p id="code-help" className={`text-center text-sm ${hasBadLetter ? "font-semibold text-bad" : "text-fg-2"}`}>
          {hasBadLetter
            ? "Codes never use the letters I or O. Check the screen again."
            : "It's on the screen at the front of the room."}
        </p>
        <button type="submit" disabled={pending || !CODE_PATTERN.test(code)} className={button({ size: "lg", full: true })}>
          <QrCode aria-hidden="true" />
          {pending ? (autoChecking ? "Checking you in…" : "Checking…") : "Check In"}
        </button>
      </form>
    </div>
  );
}
