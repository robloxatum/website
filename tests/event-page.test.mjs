import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveLocation } from "../src/lib/locations.ts";

test("known building codes expand to full name plus room, with a Maps link", () => {
  const r = resolveLocation("CCCB 1420");
  assert.equal(r.label, "Central Campus Classroom Building, Room 1420");
  assert.equal(r.mapUrl, "https://www.google.com/maps/search/?api=1&query=Central%20Campus%20Classroom%20Building%2C%20Ann%20Arbor%2C%20MI");
  assert.equal(resolveLocation("nub 2001").label, "North University Building, Room 2001");
  assert.equal(resolveLocation("NUB").label, "North University Building");
  assert.equal(resolveLocation("NUB, Atrium").label, "North University Building, Atrium");
});

test("unknown or partial codes are left as typed, without a map", () => {
  assert.deepEqual(resolveLocation("Michigan Union Ballroom"), { label: "Michigan Union Ballroom", mapUrl: null });
  assert.deepEqual(resolveLocation("CCCBX 1"), { label: "CCCBX 1", mapUrl: null });
  assert.deepEqual(resolveLocation("Discord"), { label: "Discord", mapUrl: null });
  assert.equal(resolveLocation(""), null);
  assert.equal(resolveLocation(null), null);
});

import { isCheckInTime } from "../src/lib/event-day.ts";

test("event day: check-in is the main action from 2 hours before the start until the end", () => {
  const start = Date.parse("2026-12-01T19:00:00Z");
  const e = { starts_at: "2026-12-01T19:00:00Z", ends_at: "2026-12-01T21:00:00Z" };
  const h = 3600_000;
  assert.equal(isCheckInTime(e, start - 2 * h - 1), false);
  assert.equal(isCheckInTime(e, start - 2 * h), true);
  assert.equal(isCheckInTime(e, start + h), true);
  assert.equal(isCheckInTime(e, start + 2 * h - 1), true);
  assert.equal(isCheckInTime(e, start + 2 * h), false);
});

import { formatTimeRangeShort } from "../src/lib/time.ts";

test("short time range (phones): AM/PM once when both times share it", () => {
  // 6–8 PM in Ann Arbor (EST, UTC-5).
  assert.equal(formatTimeRangeShort("2026-12-01T23:00:00Z", "2026-12-02T01:00:00Z"), "6:00 – 8:00 PM");
  // 11 AM – 1 PM keeps both.
  assert.equal(formatTimeRangeShort("2026-12-01T16:00:00Z", "2026-12-01T18:00:00Z"), "11:00 AM – 1:00 PM");
  // Across midnight: the full range with dates.
  assert.equal(formatTimeRangeShort("2026-12-02T03:00:00Z", "2026-12-02T06:00:00Z"), "Dec 1, 10:00 PM – Dec 2, 1:00 AM");
});
