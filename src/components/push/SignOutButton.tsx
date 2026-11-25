"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { turnOffNotifications } from "@/app/(main)/profile/notification-actions";
import { button } from "@/components/ui/styles";
import { currentSubscription } from "@/lib/push/browser";

/**
 * Sign out. Turns this device's notifications off first (best effort, briefly),
 * so the next person on a shared phone doesn't get this member's notifications.
 */
export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    try {
      await Promise.race([
        (async () => {
          const sub = await currentSubscription();
          if (!sub) return;
          await turnOffNotifications(sub.endpoint);
          await sub.unsubscribe();
        })(),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    } catch {
      // Signing out matters more.
    }
    form.submit();
  }

  return (
    <form action="/auth/signout" method="post" onSubmit={onSubmit}>
      <button type="submit" disabled={pending} className={button({ variant: "secondary", full: true })}>
        <LogOut aria-hidden="true" />
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </form>
  );
}
