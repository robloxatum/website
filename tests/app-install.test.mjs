// Installable app: which instructions each phone gets, and the iPhone splash screens. Run: npm test
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { installPlatform, isIpadOs, SPLASH_SCREENS, splashImages } from "../src/lib/app-install.ts";
import { detectInAppBrowser } from "../src/lib/in-app-browser.ts";

const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
// The installed iPhone app (home screen) has no "Version/... Safari/..." in its user agent.
const IOS_HOME_SCREEN = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36";
const INSTAGRAM = `${IOS_HOME_SCREEN} Instagram 330.0.0.40.92 (iPhone15,2; iOS 18_5; en_US; en; scale=3.00; 1179x2556; 598234529)`;
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";

const platform = (ua) => installPlatform(ua, Boolean(detectInAppBrowser(ua)));

describe("installPlatform", () => {
  it("tells iPhone, Android, in-app browsers and computers apart", () => {
    assert.equal(platform(SAFARI), "ios");
    assert.equal(platform(IOS_HOME_SCREEN), "ios");
    assert.equal(platform(ANDROID_CHROME), "android");
    assert.equal(platform(INSTAGRAM), "in-app");
    assert.equal(platform(MAC), "other");
    assert.equal(platform(""), "other");
  });

  it("the installed iPhone app is not mistaken for an in-app browser (Google sign-in stays on)", () => {
    assert.equal(detectInAppBrowser(IOS_HOME_SCREEN), null);
    assert.equal(detectInAppBrowser(ANDROID_CHROME), null);
  });

  it("spots iPads that say they're a Mac", () => {
    assert.equal(isIpadOs({ userAgent: MAC, maxTouchPoints: 5 }), true);
    assert.equal(isIpadOs({ userAgent: MAC, maxTouchPoints: 0 }), false);
    assert.equal(isIpadOs({ userAgent: SAFARI, maxTouchPoints: 5 }), false);
  });
});

describe("iPhone splash screens", () => {
  it("one image per screen, each file there at the right size", () => {
    const urls = splashImages().map((s) => s.url);
    assert.equal(new Set(urls).size, SPLASH_SCREENS.length);
    for (const { width, height, ratio } of SPLASH_SCREENS) {
      const file = `public/splash/${width * ratio}x${height * ratio}.png`;
      assert.ok(existsSync(file), file);
      const png = readFileSync(file);
      assert.equal(png.readUInt32BE(16), width * ratio, file);
      assert.equal(png.readUInt32BE(20), height * ratio, file);
    }
  });

  it("media queries match the phone exactly, portrait", () => {
    const s = splashImages()[0];
    assert.equal(s.media, "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)");
  });
});
