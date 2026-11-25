// In-app browsers (Instagram, GroupMe, ...). Google refuses to sign in inside
// them ("Error 403: disallowed_useragent"), so sign-in asks people to open the
// page in Safari/Chrome first. No runtime imports: the unit tests run this file
// directly with Node.

export type InAppBrowser = {
  /** The app's name, for "You're in Instagram's browser". Null for an unnamed Android WebView. */
  app: string | null;
  os: "ios" | "android" | "other";
};

const APPS: [RegExp, string][] = [
  [/Instagram/i, "Instagram"],
  [/\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFBIOS\b|\bFB4A\b|\[FB/i, "Facebook"],
  [/GroupMe/i, "GroupMe"],
  [/Discord/i, "Discord"],
  [/Snapchat/i, "Snapchat"],
  [/musical_ly|BytedanceWebview|\bTikTok\b|\btrill_|\bByteLocale\b/i, "TikTok"],
  [/LinkedInApp/i, "LinkedIn"],
  [/\bLine\//i, "LINE"],
];

/**
 * The in-app browser this user agent belongs to, or null for a real browser.
 * Also catches any Android WebView ("; wv)"), which Google blocks too.
 */
export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  const ua = userAgent ?? "";
  if (!ua) return null;
  const os = /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "other";
  const named = APPS.find(([re]) => re.test(ua));
  if (named) return { app: named[1], os };
  if (os === "android" && /; wv\)/.test(ua)) return { app: null, os };
  return null;
}

/**
 * Instagram on iPhone ignores x-safari-https:// links (even a real tap on an
 * <a href>): the button would do nothing. There, the app's own menu is the way.
 */
export function blocksDirectOpen(browser: InAppBrowser): boolean {
  return browser.os === "ios" && browser.app === "Instagram";
}

/**
 * A link that opens `url` in the real browser, where the app and OS allow it:
 *  - Android: an intent: URL for Chrome (falls back to the page itself).
 *  - iOS 17+: x-safari-https:// opens Safari (older iOS ignores it), except in
 *    Instagram, which blocks it.
 * Null when there's no such trick; people use the app's "Open in browser" menu.
 */
export function openInBrowserHref(url: string, browser: InAppBrowser): string | null {
  if (blocksDirectOpen(browser)) return null;
  const { os } = browser;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const rest = `${u.host}${u.pathname}${u.search}`;
  if (os === "android") {
    const scheme = u.protocol.slice(0, -1);
    return `intent://${rest}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
  }
  if (os === "ios" && u.protocol === "https:") return `x-safari-https://${rest}`;
  return null;
}
