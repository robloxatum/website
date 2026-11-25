"use client";

// Android Chrome (and desktop Chromium) offers "beforeinstallprompt": we keep it
// and show our own Install button instead of the browser's mini bar.
// iPhone has no such event: people use Share → Add to Home Screen (/install).

import { useSyncExternalStore } from "react";

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
let installed = false;
let listening = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Start listening (once, as early as possible: the event fires soon after load). */
export function captureInstallPrompt() {
  if (listening) return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** "ready": we can show the browser's install dialog. "installed": just installed. */
export function useInstallPrompt(): "ready" | "installed" | null {
  return useSyncExternalStore(
    subscribe,
    () => (installed ? "installed" : deferred ? "ready" : null),
    () => null,
  );
}

/** Shows the browser's install dialog (from a tap). */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const e = deferred;
  if (!e) return "unavailable";
  deferred = null; // each event can prompt once
  emit();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome;
}
