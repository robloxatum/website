"use client";

import { Check, Copy, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { button } from "./styles";

/** Copies text; falls back to a hidden textarea where the Clipboard API isn't available (older in-app browsers). */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

/**
 * The officers' email on /links: shows the address and copies it when tapped
 * (a copy icon, not the ↗ of rows that open other sites). Named "Copy email
 * address …" for screen readers; "Copied" is announced and shown for 2 seconds.
 */
export function CopyEmailButton({ address, size = "lg" }: { address: string; size?: "md" | "lg" }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick() {
    const ok = await copyText(address);
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), ok ? 2000 : 5000);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="copy-email"
      className={button({ variant: "secondary", size, full: true, className: "justify-between! text-left whitespace-normal!" })}
    >
      <span className="inline-flex min-w-0 items-center gap-3">
        <Mail aria-hidden="true" className="size-5 shrink-0 text-maize" />
        <span className="flex min-w-0 flex-col items-start py-2 text-left leading-tight">
          <span>
            <span className="sr-only">Copy </span>
            Email
            <span className="sr-only"> address</span>
          </span>
          <span className="mt-0.5 text-sm font-normal break-all text-fg-2">{address}</span>
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5">
        {/* Shown and announced after a tap. */}
        <span role="status" className={`text-sm font-semibold ${state === "failed" ? "text-bad" : "text-ok"}`}>
          {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : ""}
        </span>
        {state === "copied" ? (
          <Check aria-hidden="true" className="text-ok" />
        ) : (
          <Copy aria-hidden="true" className="text-fg-3" />
        )}
      </span>
    </button>
  );
}
