// The installable web app ("Add to Home Screen"): which instructions a phone
// gets, and the iPhone launch screens. No runtime imports: the unit tests run
// this file directly with Node.

export type InstallPlatform =
  /** Instagram, GroupMe, ...: can't install from there; open the page in the browser first. */
  | "in-app"
  /** iPhone / iPad: Share → Add to Home Screen (Safari, and Chrome etc. on iOS 16.4+). */
  | "ios"
  /** Android: the browser's menu → Install app / Add to Home screen (or our button). */
  | "android"
  /** Computers and anything else. */
  | "other";

/** `inApp`: detectInAppBrowser(userAgent) found one (lib/in-app-browser). */
export function installPlatform(userAgent: string | null | undefined, inApp: boolean): InstallPlatform {
  const ua = userAgent ?? "";
  if (inApp) return "in-app";
  // iPadOS reports itself as a Mac; the touch check happens in the browser (isIpadOs).
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** iPadOS 13+ says "Macintosh"; a Mac has no touch screen. Browser only. */
export function isIpadOs(nav: { userAgent: string; maxTouchPoints?: number }): boolean {
  return /Macintosh/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1;
}

/**
 * iPhone launch screens (public/splash/<w>x<h>.png, made by
 * scripts/make-app-icons.py): CSS width x height at a pixel ratio. iOS picks
 * the one whose media query matches the phone exactly, else shows the
 * background colour.
 */
export const SPLASH_SCREENS: { width: number; height: number; ratio: number }[] = [
  { width: 440, height: 956, ratio: 3 }, // 16/17 Pro Max
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15/16 Plus, 15 Pro Max
  { width: 420, height: 912, ratio: 3 }, // Air
  { width: 402, height: 874, ratio: 3 }, // 16 Pro, 17, 17 Pro
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 428, height: 926, ratio: 3 }, // 12/13 Pro Max, 14 Plus
  { width: 390, height: 844, ratio: 3 }, // 12, 13, 14, 16e
  { width: 375, height: 812, ratio: 3 }, // X, XS, 11 Pro, 12/13 mini
  { width: 414, height: 896, ratio: 3 }, // XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // XR, 11
  { width: 414, height: 736, ratio: 3 }, // 8 Plus
  { width: 375, height: 667, ratio: 2 }, // SE (2nd/3rd), 8
];

export function splashImages() {
  return SPLASH_SCREENS.map(({ width, height, ratio }) => ({
    url: `/splash/${width * ratio}x${height * ratio}.png`,
    media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
  }));
}
