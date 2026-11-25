// In-app browser detection (Google blocks sign-in there). Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blocksDirectOpen, detectInAppBrowser, openInBrowserHref } from "../src/lib/in-app-browser.ts";

const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID_WV = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36";

const IN_APP = {
  Instagram: [
    `${IOS} Instagram 330.0.0.40.92 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 598234529)`,
    `${ANDROID_WV} Instagram 330.0.0.40.92 Android (34/14; 420dpi; 1080x2400; Google; Pixel 8; shiba; en_US; 598234529)`,
  ],
  Facebook: [
    `${IOS} [FBAN/FBIOS;FBAV/467.0.0.40.108;FBBV/600000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]`,
    `${ANDROID_WV} [FB_IAB/FB4A;FBAV/467.0.0.48.110;]`,
    `${IOS} [FBAN/MessengerForiOS;FBAV/460.0.0.36.110;FBBV/500000000]`,
  ],
  GroupMe: [`${IOS} GroupMe/5.84.0`, `${ANDROID_WV} GroupMe/6.12.1`],
  Discord: [`${IOS} Discord/235.0`, `${ANDROID_WV} Discord/235.0`],
  Snapchat: [`${IOS} Snapchat/13.1.0.37 (like Safari/8618.2.12.10.4, panda)`, `${ANDROID_WV} Snapchat/13.1.0.37 (SM-S911B; Android 14#xx#34; gzip)`],
  TikTok: [
    `${IOS} musical_ly_34.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US`,
    `${ANDROID_WV} trill_2023405020 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/34.5.0 ByteLocale/en BytedanceWebview/d8a21c6`,
  ],
  LinkedIn: [`${IOS} [LinkedInApp]/9.29.8970`],
};

const REAL = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
];

describe("detectInAppBrowser", () => {
  for (const [app, uas] of Object.entries(IN_APP)) {
    it(`detects ${app}`, () => {
      for (const ua of uas) {
        const r = detectInAppBrowser(ua);
        assert.equal(r?.app, app, ua);
        assert.equal(r?.os, ua.includes("iPhone") ? "ios" : "android");
      }
    });
  }

  it("detects any other Android WebView", () => {
    assert.deepEqual(detectInAppBrowser(ANDROID_WV), { app: null, os: "android" });
  });

  it("leaves real browsers alone", () => {
    for (const ua of REAL) assert.equal(detectInAppBrowser(ua), null, ua);
    assert.equal(detectInAppBrowser(""), null);
    assert.equal(detectInAppBrowser(undefined), null);
  });
});

describe("openInBrowserHref", () => {
  const url = "https://robloxatum.vercel.app/login?next=%2Fcheckin%3Fcode%3DABCDE";

  it("uses an intent URL for Chrome on Android, keeping the path and query", () => {
    assert.equal(
      openInBrowserHref(url, { app: null, os: "android" }),
      `intent://robloxatum.vercel.app/login?next=%2Fcheckin%3Fcode%3DABCDE#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`,
    );
  });

  it("uses x-safari-https on iOS", () => {
    assert.equal(openInBrowserHref(url, { app: "GroupMe", os: "ios" }), "x-safari-https://robloxatum.vercel.app/login?next=%2Fcheckin%3Fcode%3DABCDE");
    assert.equal(openInBrowserHref("http://localhost:3000/join", { app: "GroupMe", os: "ios" }), null);
  });

  it("has nothing to offer elsewhere, or for odd URLs", () => {
    assert.equal(openInBrowserHref(url, { app: "Discord", os: "other" }), null);
    assert.equal(openInBrowserHref("javascript:alert(1)", { app: null, os: "android" }), null);
    assert.equal(openInBrowserHref("not a url", { app: "GroupMe", os: "ios" }), null);
  });
});

describe("Instagram on iPhone: no Open in Safari link (Instagram ignores it)", () => {
  const url = "https://robloxatum.vercel.app/join";
  const ig = detectInAppBrowser(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.40.92 (iPhone15,2; iOS 17_5; en_US)",
  );
  it("is detected and blocked", () => {
    assert.deepEqual(ig, { app: "Instagram", os: "ios" });
    assert.equal(blocksDirectOpen(ig), true);
    assert.equal(openInBrowserHref(url, ig), null);
  });
  it("other iPhone apps and Instagram on Android still get a link", () => {
    assert.match(openInBrowserHref(url, { app: "GroupMe", os: "ios" }), /^x-safari-https:/);
    assert.equal(blocksDirectOpen({ app: "Instagram", os: "android" }), false);
    assert.match(openInBrowserHref(url, { app: "Instagram", os: "android" }), /^intent:/);
  });
});
