"use client";

import { ArrowUpRight, Check, Compass, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { button, card } from "@/components/ui/styles";
import { type InAppBrowser, openInBrowserHref } from "@/lib/in-app-browser";

/**
 * Shown instead of the Google button inside Instagram, GroupMe, Discord, ...
 * Google blocks sign-in there. One version for every app and phone, naming no
 * browser: use the app's menu to open the page in the browser, or copy the link.
 * Android also gets a button that hands the page to the default browser.
 */
export function InAppBrowserNotice({ browser }: { browser: InAppBrowser }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const url = typeof window === "undefined" ? "" : window.location.href;
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
      {/* Points up at the app's menu (above the page's top-right corner), from just
          under our 4rem header (with room for the bounce) so it never covers the
          header's links. */}
      <div
        data-testid="menu-arrow"
        aria-hidden="true"
        className="pointer-events-none fixed top-[calc(4rem+1rem+env(safe-area-inset-top))] right-3 z-[60] flex items-start gap-1 rounded-xl bg-maize px-2.5 py-1.5 font-semibold text-navy shadow-lg motion-safe:animate-bounce"
      >
        <span className="text-sm">Menu</span>
        <ArrowUpRight className="size-5" strokeWidth={2.75} />
      </div>

      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-maize/15">
          <Compass aria-hidden="true" className="size-5 text-maize" />
        </span>
        <div>
          <h2 id="in-app-title" className="text-lg text-fg">
            Open this page in your browser to sign in
          </h2>
          <p className="mt-1 text-sm text-fg-2">
            You&apos;re in an app&apos;s built-in browser, and Google doesn&apos;t allow signing in here.
          </p>
        </div>
      </div>

      <ol aria-label="How to open this page in your browser" className="space-y-2 rounded-xl border border-maize/40 bg-maize/10 p-4 text-fg">
        <li className="flex gap-3">
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-maize text-sm font-bold text-navy">1</span>
          <span>
            Tap the menu at the top right (<strong>•••</strong> or <strong>⋮</strong>) → <strong>Open in browser</strong>
          </span>
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-maize text-sm font-bold text-navy">2</span>
          <span>Sign in with your umich account there.</span>
        </li>
      </ol>

      {open && (
        <a href={open} className={button({ size: "lg", full: true })}>
          <ExternalLink aria-hidden="true" />
          Open in browser
        </a>
      )}
      <button type="button" onClick={copy} className={button({ variant: "secondary", size: "lg", full: true })}>
        {copied === "yes" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied === "yes" ? "Copied!" : "Copy link"}
      </button>
      <div aria-live="polite" className="text-sm empty:hidden">
        {copied === "yes" && <p className="text-fg-2">Copied! Now paste it into your browser.</p>}
        {copied === "failed" && (
          <div className="space-y-2">
            <p className="text-fg-2">Couldn&apos;t copy automatically. Press and hold the link to copy it:</p>
            <p className="rounded-lg border border-line bg-bg-2 px-3 py-2 break-all text-fg select-all">{url}</p>
          </div>
        )}
      </div>
    </div>
  );
}
