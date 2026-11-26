// Flyer QR links (/officer/flyer) and how their visits show up in analytics. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyticsPath, eventUrl, joinUrl, sanitizeLabel, shortlinkUrl, trackedPath } from "../src/lib/flyer-links.ts";

const BASE = "https://robloxatum.vercel.app";
const ID = "3f2c9a1e-8b7d-4c6e-9f00-112233445566";

describe("flyer QR links", () => {
  it("event page, with and without a label", () => {
    assert.equal(eventUrl(BASE, ID, ""), `${BASE}/events/${ID}`);
    assert.equal(eventUrl(BASE, ID, "diag-board"), `${BASE}/events/${ID}?src=diag-board`);
    assert.equal(eventUrl(`${BASE}/`, ID, "x"), `${BASE}/events/${ID}?src=x`, "no double slash");
  });

  it("join page and short links are unchanged", () => {
    assert.equal(joinUrl(BASE, ""), `${BASE}/join`);
    assert.equal(joinUrl(`${BASE}/`, "flyer-winter27"), `${BASE}/join?src=flyer-winter27`);
    assert.equal(shortlinkUrl(`${BASE}/`, "signup"), `${BASE}/go/signup`);
  });

  it("labels are lowercase letters, numbers, - and _", () => {
    assert.equal(sanitizeLabel("  Diag Board!! "), "diag-board");
    assert.equal(sanitizeLabel("---a__b---"), "a__b");
    assert.equal(sanitizeLabel("é"), "");
    assert.equal(sanitizeLabel("x".repeat(80)).length, 48);
  });
});

describe("analytics paths (same /…/src/<label> style for Join and event pages)", () => {
  it("folds the label into the path", () => {
    assert.equal(analyticsPath("/join?src=flyer-1"), "/join/src/flyer-1");
    assert.equal(analyticsPath(`/events/${ID}?src=diag-board`), `/events/${ID}/src/diag-board`);
    assert.equal(trackedPath(`/events/${ID}`, "Diag Board"), `/events/${ID}/src/diag-board`);
  });

  it("no label, or a page that isn't tracked: the path as is", () => {
    assert.equal(analyticsPath("/join"), "/join");
    assert.equal(analyticsPath(`/events/${ID}`), `/events/${ID}`);
    assert.equal(analyticsPath("/events?src=x"), "/events");
    assert.equal(analyticsPath("/events/not-an-id?src=x"), "/events/not-an-id");
    assert.equal(analyticsPath(`/events/${ID}/calendar.ics?src=x`), `/events/${ID}/calendar.ics`);
    assert.equal(trackedPath("/join", "!!!"), "/join");
  });
});
