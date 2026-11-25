"use client";

import { Check, Download, Ellipsis, EllipsisVertical, Share, SquarePlus } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Alert } from "@/components/ui/Alert";
import { button, card } from "@/components/ui/styles";
import { installPlatform, isIpadOs, type InstallPlatform } from "@/lib/app-install";
import { detectInAppBrowser } from "@/lib/in-app-browser";
import { promptInstall, useInstallPrompt } from "@/lib/install-prompt";
import { isStandalone } from "@/lib/push/browser";

const noSubscribe = () => () => {};

/** This visitor's platform; null on the server and during hydration. */
function usePlatform(): InstallPlatform | null {
  const ua = useSyncExternalStore(noSubscribe, () => navigator.userAgent, () => "");
  const ipad = useSyncExternalStore(noSubscribe, () => isIpadOs(navigator), () => false);
  if (!ua) return null;
  return ipad ? "ios" : installPlatform(ua, Boolean(detectInAppBrowser(ua)));
}

function useStandalone() {
  return useSyncExternalStore(noSubscribe, isStandalone, () => false);
}

/** Top of /install: already in the app, in an in-app browser, or (Android) an Install button. */
export function InstallStatus() {
  const platform = usePlatform();
  const standalone = useStandalone();
  const prompt = useInstallPrompt();
  const [declined, setDeclined] = useState(false);

  if (standalone || prompt === "installed") {
    return (
      <Alert tone="success" title={standalone ? "You're using the app" : "Installed"}>
        {standalone ? (
          <>
            Turn on notifications from your{" "}
            <Link href="/profile" className="font-semibold text-maize hover:underline">
              profile
            </Link>
            .
          </>
        ) : (
          "Open Roblox at UM from your home screen."
        )}
      </Alert>
    );
  }
  if (platform === "in-app") {
    return (
      <Alert tone="warning" title="Open this page in your browser first">
        Apps like Instagram and GroupMe can&apos;t add pages to your Home Screen. Tap the menu at the top right (••• or ⋮) →
        Open in browser, then follow the steps below.
      </Alert>
    );
  }
  if (prompt === "ready") {
    return (
      <div className={`${card} space-y-3 p-5`}>
        <p className="text-fg">Your browser can install it right now.</p>
        <button
          type="button"
          onClick={async () => setDeclined((await promptInstall()) !== "accepted")}
          className={button({ size: "lg", full: true })}
        >
          <Download aria-hidden="true" />
          Install the app
        </button>
      </div>
    );
  }
  if (declined) return <p className="text-fg-2">No problem. You can install it later from your browser&apos;s menu.</p>;
  return null;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-maize text-sm font-bold text-navy">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

const icon = "mx-0.5 inline size-[1.1em] -translate-y-px text-maize";

function IPhoneSteps() {
  return (
    <ol aria-label="Steps for iPhone and iPad" className="space-y-3 text-fg">
      <Step n={1}>
        In Safari, tap <strong>Share</strong> <Share aria-hidden="true" className={icon} /> (on iOS 26, it&apos;s in the{" "}
        <strong>•••</strong> <Ellipsis aria-hidden="true" className={icon} /> menu first).
      </Step>
      <Step n={2}>
        Scroll down and tap <strong>Add to Home Screen</strong> <SquarePlus aria-hidden="true" className={icon} />.
      </Step>
      <Step n={3}>
        Keep <strong>Open as Web App</strong> on, then tap <strong>Add</strong>.
      </Step>
      <Step n={4}>Open Roblox at UM from your Home Screen and sign in.</Step>
    </ol>
  );
}

function AndroidSteps() {
  return (
    <ol aria-label="Steps for Android" className="space-y-3 text-fg">
      <Step n={1}>
        In Chrome, tap the menu <strong>⋮</strong> <EllipsisVertical aria-hidden="true" className={icon} /> at the top right.
      </Step>
      <Step n={2}>
        Tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>), then <strong>Install</strong>.
      </Step>
      <Step n={3}>Open Roblox at UM from your home screen and sign in.</Step>
    </ol>
  );
}

/** Both sets of steps; this visitor's phone first, marked "Your phone". */
export function PlatformSteps() {
  const platform = usePlatform();
  const sections = [
    { key: "ios", title: "iPhone and iPad", steps: <IPhoneSteps />, note: "Chrome on iPhone works too: Share in the address bar → Add to Home Screen." },
    { key: "android", title: "Android", steps: <AndroidSteps />, note: "Samsung Internet: menu ≡ → Add page to → Home screen." },
  ];
  if (platform === "android") sections.reverse();
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <section key={s.key} aria-labelledby={`steps-${s.key}`} className={`${card} space-y-4 p-5 ${platform === s.key ? "border-maize/50" : ""}`}>
          <h2 id={`steps-${s.key}`} className="flex flex-wrap items-center gap-2 text-xl text-fg">
            {s.title}
            {platform === s.key && (
              <span className="inline-flex items-center gap-1 rounded-md bg-maize px-2 py-0.5 text-sm font-bold text-navy">
                <Check aria-hidden="true" className="size-4" />
                Your phone
              </span>
            )}
          </h2>
          {s.steps}
          <p className="text-sm text-fg-2">{s.note}</p>
        </section>
      ))}
    </div>
  );
}
