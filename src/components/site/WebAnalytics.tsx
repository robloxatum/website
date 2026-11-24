"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics (cookie-free). Before anything is sent:
 *  - every query string is dropped, so check-in codes (/checkin?code=…) and
 *    sign-in return paths never leave the browser;
 *  - /join?src=<label> is reported as the path /join/src/<label>, so each
 *    flyer shows up as its own row in the free "Pages" report.
 */
export function redactForAnalytics(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  const src = url.pathname === "/join" ? url.searchParams.get("src") : null;
  const label = src?.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  if (label) url.pathname = `/join/src/${label}`;
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}

export function WebAnalytics() {
  return <Analytics beforeSend={redactForAnalytics} />;
}
