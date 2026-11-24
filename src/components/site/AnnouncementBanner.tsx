"use client";

import { ArrowRight, Megaphone, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { container } from "@/components/ui/styles";
import { type Announcement, dismissKey, isExternal } from "@/lib/announcement";

const DISMISS_EVENT = "announcement-dismissed";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DISMISS_EVENT, onChange);
  };
}

function readDismissed(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false; // storage blocked: just show it
  }
}

/**
 * Slim bar under the header. Dismissing is remembered per announcement (its
 * id) in localStorage, so a new announcement shows again. It hides itself at
 * its "hide after" time.
 */
export function AnnouncementBanner({ announcement }: { announcement: Announcement }) {
  const key = dismissKey(announcement.id);
  // Server/hydration snapshot: hidden, so a dismissed bar never flashes.
  const dismissed = useSyncExternalStore(subscribe, () => readDismissed(key), () => true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!announcement.hide_after) return;
    const ms = new Date(announcement.hide_after).getTime() - Date.now();
    // Already past (e.g. a cached page): hide right away; otherwise at the time.
    const t = setTimeout(() => setExpired(true), Math.max(0, Math.min(ms, 2 ** 31 - 1)));
    return () => clearTimeout(t);
  }, [announcement.hide_after]);

  if (dismissed || expired) return null;

  const urgent = announcement.style === "urgent";
  const tone = urgent ? "bg-maize text-navy" : "border-b border-line/60 bg-navy text-fg";
  const link = announcement.link;
  const linkClass = `inline-flex items-center gap-1 font-bold underline underline-offset-2 ${urgent ? "decoration-navy/50" : "decoration-maize/60 text-maize"}`;

  return (
    <div role="region" aria-label="Announcement" className={tone}>
      <div className={`${container} flex min-h-11 items-center gap-3 py-2 text-sm sm:text-base`}>
        <Megaphone aria-hidden="true" className="size-4 shrink-0 sm:size-5" />
        <p className="min-w-0 flex-1 font-semibold">
          {announcement.message}{" "}
          {link &&
            (isExternal(link) ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className={linkClass}>
                Learn more <ArrowRight aria-hidden="true" className="size-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              <Link href={link} className={linkClass}>
                Learn more <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            ))}
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(key, "1");
            } catch {}
            window.dispatchEvent(new Event(DISMISS_EVENT));
          }}
          className={`grid size-11 shrink-0 place-items-center rounded-lg transition-colors duration-150 ${
            urgent ? "hover:bg-navy/10" : "hover:bg-white/[0.08]"
          }`}
          aria-label="Dismiss announcement"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  );
}
