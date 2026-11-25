"use client";

import { Check, Compass, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { button, card } from "@/components/ui/styles";
import { type InAppBrowser, openInBrowserHref } from "@/lib/in-app-browser";

/**
 * Shown instead of the Google button inside Instagram, GroupMe, Discord, ...
 * Google blocks sign-in there, so: open this page in Safari/Chrome (a direct
 * button where the OS allows it), or copy the link and paste it there.
 */
export function InAppBrowserNotice({ browser }: { browser: InAppBrowser }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const url = typeof window === "undefined" ? "" : window.location.href;
  const real = browser.os === "ios" ? "Safari" : browser.os === "android" ? "Chrome" : "your browser";
  const where = browser.app ? `${browser.app}'s built-in browser` : "this app's built-in browser";
  const open = url ? openInBrowserHref(url, browser.os) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div role="region" aria-labelledby="in-app-title" className={`${card} space-y-4 border-maize/40 p-5`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-maize/15">
          <Compass aria-hidden="true" className="size-5 text-maize" />
        </span>
        <div>
          <h2 id="in-app-title" className="text-lg text-fg">
            Open in {real} to sign in
          </h2>
          <p className="mt-1 text-sm text-fg-2">
            You&apos;re in {where}, and Google doesn&apos;t allow signing in here. Open this page in {real}, then sign in
            with your umich account.
          </p>
        </div>
      </div>

      {open && (
        <a href={open} className={button({ size: "lg", full: true })}>
          <ExternalLink aria-hidden="true" />
          Open in {real}
        </a>
      )}
      <button type="button" onClick={copy} className={button({ variant: open ? "secondary" : "primary", size: "lg", full: true })}>
        {copied === "yes" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied === "yes" ? "Link copied" : "Copy link"}
      </button>
      <div aria-live="polite" className="text-sm empty:hidden">
        {copied === "yes" && <p className="text-fg-2">Now open {real} and paste it into the address bar.</p>}
        {copied === "failed" && (
          <div className="space-y-2">
            <p className="text-fg-2">Couldn&apos;t copy automatically. Press and hold the link to copy it:</p>
            <p className="rounded-lg border border-line bg-bg-2 px-3 py-2 break-all text-fg select-all">{url}</p>
          </div>
        )}
      </div>
      <p className="text-sm text-fg-3">
        {browser.os === "ios"
          ? "Or tap ••• (or the share icon) at the top or bottom of the screen, then “Open in Safari” or “Open in browser”."
          : "Or tap ⋮ at the top of the screen, then “Open in Chrome” or “Open in browser”."}
      </p>
    </div>
  );
}
