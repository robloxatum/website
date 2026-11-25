"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/install-prompt";

/**
 * The installable app's page-side setup, on every page: keeps Android's
 * install prompt for our own Install buttons, and registers public/sw.js (push
 * notifications, offline page) once the page has loaded. The worker is
 * production only, so `next dev` never serves a stale one.
 */
export function InstallableApp() {
  useEffect(() => {
    captureInstallPrompt();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => {
        console.warn("Service worker registration failed", e);
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
