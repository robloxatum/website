// In-app browsers (Instagram, GroupMe, ...). Google refuses to sign in inside
// them ("Error 403: disallowed_useragent"), so sign-in asks people to open the
// page in their real browser first. No runtime imports: the unit tests run this file
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
 * Android only: an intent:// link that hands `url` to the phone's default
 * browser (no app named, so whichever browser they use; falls back to the page
 * itself). iPhone apps have no reliable equivalent, so people use the app's menu.
 */
export function openInBrowserHref(url: string, os: InAppBrowser["os"]): string | null {
  if (os !== "android") return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const scheme = u.protocol.slice(0, -1);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
}
