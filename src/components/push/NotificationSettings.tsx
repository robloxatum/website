"use client";

import { Bell, BellOff, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  changeNotificationSettings,
  readNotificationSettings,
  turnOffNotifications,
  turnOnNotifications,
} from "@/app/(main)/profile/notification-actions";
import { Alert } from "@/components/ui/Alert";
import { button, card } from "@/components/ui/styles";
import { currentSubscription, isStandalone, pushSupported, subscribe } from "@/lib/push/browser";

type Settings = { eventReminders: boolean; gameLinks: boolean };
type State =
  | { kind: "checking" }
  | { kind: "install-first" } // iPhone/iPad in a browser tab: push needs the home-screen app
  | { kind: "unsupported" }
  | { kind: "blocked" }
  | { kind: "off" }
  | { kind: "on"; endpoint: string };

const OPTIONS: { key: keyof Settings; title: string; detail: string }[] = [
  { key: "eventReminders", title: "Event reminders", detail: "The day of each event: what, when and where." },
  { key: "gameLinks", title: "Game link is live", detail: "When an officer posts the game link at an event you're checked in to." },
];

/** "Notifications" on the profile page: this device's opt-in push settings. */
export function NotificationSettings({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [settings, setSettings] = useState<Settings>({ eventReminders: true, gameLinks: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
      let next: State;
      if (!pushSupported()) next = { kind: ios && !isStandalone() ? "install-first" : "unsupported" };
      else if (Notification.permission === "denied") next = { kind: "blocked" };
      else {
        const sub = Notification.permission === "granted" ? await currentSubscription() : null;
        const mine = sub ? await readNotificationSettings(sub.endpoint) : null;
        if (sub && mine) {
          if (live) setSettings(mine);
          next = { kind: "on", endpoint: sub.endpoint };
        } else next = { kind: "off" };
      }
      if (live) setState(next);
    })().catch(() => live && setState({ kind: "off" }));
    return () => {
      live = false;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // Ask first, straight from the tap (iPhone requires that).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState({ kind: permission === "denied" ? "blocked" : "off" });
        if (permission !== "denied") setError("Notifications weren't allowed. Tap the button again to allow them.");
        return;
      }
      const sub = await subscribe(vapidPublicKey);
      const r = await turnOnNotifications(sub.toJSON(), settings);
      if (r.error) setError(r.error);
      else setState({ kind: "on", endpoint: sub.endpoint });
    } catch {
      setError("Couldn't turn on notifications on this device. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (state.kind !== "on") return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await turnOffNotifications(state.endpoint);
      await (await currentSubscription())?.unsubscribe();
      setState({ kind: "off" });
    } catch {
      setError("Couldn't turn notifications off. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function change(key: keyof Settings, value: boolean) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaved(false);
    if (state.kind !== "on") return;
    setError(null);
    const r = await changeNotificationSettings(state.endpoint, next);
    if (r.error) {
      setError(r.error);
      setSettings(settings);
    } else setSaved(true);
  }

  return (
    <section aria-labelledby="notifications-title">
      <h2 id="notifications-title" className="mb-3 flex items-center gap-2.5 text-xl text-fg">
        <Bell aria-hidden="true" className="size-6 text-maize" />
        Notifications
      </h2>
      <div className={`${card} space-y-4 p-5`}>
        {state.kind === "checking" && <p className="text-fg-2">Checking this device…</p>}

        {state.kind === "install-first" && (
          <div className="space-y-3">
            <p className="text-fg">
              On iPhone and iPad, notifications work in the app: add Roblox at UM to your Home Screen, open it from there, and
              turn them on here.
            </p>
            <Link href="/install" className={button({ variant: "secondary", full: true })}>
              <Smartphone aria-hidden="true" />
              How to add it to your Home Screen
            </Link>
          </div>
        )}

        {state.kind === "unsupported" && <p className="text-fg-2">This browser can&apos;t show notifications. Try Chrome, Safari or Firefox.</p>}

        {state.kind === "blocked" && (
          <Alert tone="warning" title="Notifications are blocked">
            Allow notifications for this site in your browser or phone settings, then reload this page.
          </Alert>
        )}

        {(state.kind === "off" || state.kind === "on") && (
          <>
            <p className="text-fg-2">
              {state.kind === "on" ? "On for this device. Choose what you get:" : "Get a notification on this device for:"}
            </p>
            <div className="space-y-2">
              {OPTIONS.map((o) => (
                <label
                  key={o.key}
                  className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-line/60 bg-bg-2/40 px-4 py-2"
                >
                  <span>
                    <span className="block font-semibold text-fg">{o.title}</span>
                    <span className="block text-sm text-fg-3">{o.detail}</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={settings[o.key]}
                    disabled={busy}
                    onChange={(e) => change(o.key, e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-maize ${
                      settings[o.key] ? "bg-maize" : "bg-elevated"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-150 ${settings[o.key] ? "translate-x-5" : ""}`}
                    />
                  </span>
                </label>
              ))}
            </div>
            {state.kind === "off" ? (
              <button
                type="button"
                onClick={turnOn}
                disabled={busy || (!settings.eventReminders && !settings.gameLinks)}
                className={button({ full: true })}
              >
                <Bell aria-hidden="true" />
                {busy ? "Turning on…" : "Turn on notifications"}
              </button>
            ) : (
              <button type="button" onClick={turnOff} disabled={busy} className={button({ variant: "secondary", full: true })}>
                <BellOff aria-hidden="true" />
                {busy ? "Turning off…" : "Turn off on this device"}
              </button>
            )}
          </>
        )}

        <div aria-live="polite" className="empty:hidden">
          {saved && <p className="text-sm text-fg-2">Saved.</p>}
          {error && (
            <p role="alert" className="font-semibold text-bad">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
