"use client";

import { useEffect } from "react";

/**
 * Scrolls to the #section in the address (e.g. /about#founders) once the
 * streamed content is on the page. The browser only tries when the page
 * starts loading, before a Suspense section exists, so on a slow connection
 * links like "Meet the founders" would otherwise land at the top.
 */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
