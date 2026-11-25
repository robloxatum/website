"use client";

import { Download, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import icon from "@/assets/brand/icon.png";
import { container } from "@/components/ui/styles";
import { installPlatform, isIpadOs } from "@/lib/app-install";
import { detectInAppBrowser } from "@/lib/in-app-browser";
import { promptInstall, useInstallPrompt } from "@/lib/install-prompt";
import { isStandalone } from "@/lib/push/browser";

const KEY = "install-bar-dismissed-at";
const CHANGED = "install-bar-dismissed";
const QUIET_DAYS = 30;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** Show it? Phones only, not in the app already, not in Instagram & co., not dismissed lately. */
function eligible(): boolean {
  const ua = navigator.userAgent;
  const platform = isIpadOs(navigator) ? "ios" : installPlatform(ua, Boolean(detectInAppBrowser(ua)));
  if ((platform !== "ios" && platform !== "android") || isStandalone()) return false;
  try {
    const at = Number(localStorage.getItem(KEY));
    return !at || Date.now() - at > QUIET_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false; // storage blocked: it couldn't stay dismissed, so don't nag
  }
}

function dismiss() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {}
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * "Get the app" bar under the header, for signed-in members on a phone browser.
 * Android (when the browser offers it): installs right here. Otherwise links to
 * /install. Closing it hides it for 30 days.
 */
export function InstallBar() {
  // Server/hydration snapshot: hidden, so it never flashes for people who closed it.
  const show = useSyncExternalStore(subscribe, eligible, () => false);
  const prompt = useInstallPrompt();
  const path = usePathname();
  if (!show || prompt === "installed" || path === "/install") return null;

  return (
    <div role="region" aria-label="Get the app" className="border-b border-line/60 bg-bg-2 md:hidden">
      <div className={`${container} flex min-h-14 items-center gap-3 py-2`}>
        <Image src={icon} alt="" className="size-9 shrink-0 rounded-lg bg-navy p-1.5" sizes="36px" />
        <p className="min-w-0 flex-1 text-sm leading-snug text-fg">
          <span className="block font-semibold">Get the app</span>
          <span className="block text-fg-2">One tap to check in, plus reminders.</span>
        </p>
        {prompt === "ready" ? (
          <button
            type="button"
            onClick={async () => {
              if ((await promptInstall()) === "accepted") dismiss();
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-maize px-3 text-sm font-bold text-navy"
          >
            <Download aria-hidden="true" className="size-4" />
            Install
          </button>
        ) : (
          <Link href="/install" className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-maize px-3 text-sm font-bold text-navy">
            How
          </Link>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="grid size-11 shrink-0 place-items-center rounded-lg text-fg-2 transition-colors duration-150 hover:bg-white/[0.08]"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  );
}
