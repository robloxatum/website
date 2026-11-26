"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { trackedPath } from "@/lib/flyer-links";

/**
 * Vercel Web Analytics (cookie-free). Before anything is sent:
 *  - every query string is dropped, so check-in codes (/checkin?code=…) and
 *    sign-in return paths never leave the browser;
 *  - /join?src=<label> is reported as the path /join/src/<label> (and an
 *    event page /events/<id>?src=<label> as /events/<id>/src/<label>), so
 *    each flyer shows up as its own row in the free "Pages" report.
 */
export function redactForAnalytics(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.pathname = trackedPath(url.pathname, url.searchParams.get("src"));
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}

export function WebAnalytics() {
  return <Analytics beforeSend={redactForAnalytics} />;
}
