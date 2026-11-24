// Add to calendar: .ics file and Google Calendar link. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIcs, eventUid, googleCalendarUrl, icsFileName, shortDescription } from "../src/lib/calendar.ts";

const URL_ = "https://robloxatum.vercel.app/events/b5985eda-7c47-4f59-9314-aaf2ae6672fb";
const winter = {
  id: "b5985eda-7c47-4f59-9314-aaf2ae6672fb",
  title: "Game Night; Obby, Tycoons & more",
  description: "Bring a laptop.\nFree pizza!",
  location: "CCCB 2640",
  starts_at: "2026-11-25T21:15:00Z", // 4:15 PM EST
  ends_at: "2026-11-25T22:15:00Z",
  updated_at: "2026-11-24T10:00:00Z",
};
const unfold = (ics) => ics.replace(/\r\n /g, "");

describe("buildIcs", () => {
  const ics = buildIcs(winter, URL_);
  const flat = unfold(ics);

  it("is a CRLF calendar with one event and the Detroit time zone", () => {
    assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.equal(ics.split("\r\n").filter((l) => l.includes("\n")).length, 0, "no bare LF");
    assert.equal(flat.match(/BEGIN:VEVENT/g).length, 1);
    assert.match(flat, /BEGIN:VTIMEZONE\r\nTZID:America\/Detroit/);
  });

  it("uses local Ann Arbor times (EST in winter, EDT in summer)", () => {
    assert.match(flat, /DTSTART;TZID=America\/Detroit:20261125T161500\r\n/);
    assert.match(flat, /DTEND;TZID=America\/Detroit:20261125T171500\r\n/);
    const summer = unfold(buildIcs({ ...winter, starts_at: "2026-07-01T22:00:00Z", ends_at: "2026-07-01T23:30:00Z" }, URL_));
    assert.match(summer, /DTSTART;TZID=America\/Detroit:20260701T180000\r\n/);
  });

  it("keeps the same UID across downloads and edits; SEQUENCE grows with edits", () => {
    const later = unfold(buildIcs({ ...winter, title: "Renamed", updated_at: "2026-11-24T12:00:00Z" }, URL_));
    const uid = (s) => s.match(/UID:(.*)\r\n/)[1];
    const seq = (s) => Number(s.match(/SEQUENCE:(\d+)\r\n/)[1]);
    assert.equal(uid(flat), eventUid(winter.id));
    assert.equal(uid(later), uid(flat));
    assert.equal(unfold(buildIcs(winter, URL_)), flat, "same event, same file");
    assert.ok(seq(later) > seq(flat));
  });

  it("escapes text and includes location, description and the event URL", () => {
    assert.match(flat, /SUMMARY:Game Night\\; Obby\\, Tycoons & more\r\n/);
    assert.match(flat, /LOCATION:CCCB 2640\r\n/);
    assert.match(flat, /DESCRIPTION:Bring a laptop\.\\nFree pizza!\\n\\nDetails: https:\/\/robloxatum/);
    assert.match(flat, new RegExp(`URL:${URL_}\\r\\n`));
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const long = buildIcs({ ...winter, description: "Ünïcödé 🎮 ".repeat(60) }, URL_);
    for (const line of long.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
    assert.ok(unfold(long).includes("Ünïcödé 🎮"));
  });

  it("omits LOCATION when there is none", () => {
    assert.ok(!unfold(buildIcs({ ...winter, location: "  " }, URL_)).includes("\r\nLOCATION:"));
  });
});

describe("googleCalendarUrl", () => {
  it("prefills title, UTC dates, Detroit zone, details and location", () => {
    const u = new URL(googleCalendarUrl(winter, URL_));
    assert.equal(u.origin + u.pathname, "https://calendar.google.com/calendar/render");
    assert.equal(u.searchParams.get("action"), "TEMPLATE");
    assert.equal(u.searchParams.get("text"), winter.title);
    assert.equal(u.searchParams.get("dates"), "20261125T211500Z/20261125T221500Z");
    assert.equal(u.searchParams.get("ctz"), "America/Detroit");
    assert.equal(u.searchParams.get("location"), "CCCB 2640");
    assert.ok(u.searchParams.get("details").endsWith(`Details: ${URL_}`));
  });
});

describe("helpers", () => {
  it("shortens long descriptions", () => {
    const d = shortDescription("x".repeat(1000), URL_);
    assert.ok(d.length < 400 && d.includes("…"));
  });
  it("makes safe file names", () => {
    assert.equal(icsFileName("Game Night: Obby/Tycoons!"), "Game-Night-ObbyTycoons.ics");
    assert.equal(icsFileName("🎮"), "event.ics");
  });
});
