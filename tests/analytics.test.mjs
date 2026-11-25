// Officer analytics: ranges and derived numbers. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatChange,
  formatPercent,
  growthWithTotals,
  monthLabel,
  parseRange,
  percentChange,
  rangeBounds,
  semesterOf,
  showUpRate,
  summarize,
  timingSummary,
} from "../src/lib/analytics.ts";

const ev = (checkins, rsvps = 0, rsvps_showed = 0) => ({
  id: "x", title: "t", starts_at: "2026-09-01T22:00:00Z", category: "social",
  cover_path: null, cover_width: null, cover_height: null,
  checkins, first_timers: 0, rsvps, rsvps_showed,
});
const base = {
  members_total: 100, members_new: 10, members_before: 90, checkins_all_time: 50,
  events: [], by_category: [], growth: [], returning: { attendees: 0, two_plus: 0 },
  timing: { before_start: 0, min_0_10: 0, min_10_20: 0, min_20_30: 0, min_30_60: 0, min_60_plus: 0, median: null, p80: null },
  prev: null,
};

describe("ranges", () => {
  it("defaults to this semester", () => {
    assert.equal(parseRange(undefined), "semester");
    assert.equal(parseRange("nonsense"), "semester");
    assert.equal(parseRange("30d"), "30d");
    assert.equal(parseRange("all"), "all");
  });

  it("knows the Michigan terms, at midnight club time", () => {
    const fall = semesterOf(new Date("2026-11-24T15:00:00Z"));
    assert.equal(fall.name, "Fall 2026");
    assert.equal(fall.start.toISOString(), "2026-08-15T04:00:00.000Z"); // EDT
    const winter = semesterOf(new Date("2027-02-10T15:00:00Z"));
    assert.equal(winter.name, "Winter 2027");
    assert.equal(winter.start.toISOString(), "2027-01-01T05:00:00.000Z"); // EST
    assert.equal(semesterOf(new Date("2026-06-01T15:00:00Z")).name, "Spring/Summer 2026");
    // 11 pm Dec 31 in Detroit is already Jan 1 in UTC: still Fall.
    assert.equal(semesterOf(new Date("2027-01-01T04:00:00Z")).name, "Fall 2026");
  });

  it("rolls from Fall to Winter at midnight Jan 1 (club time), from the date passed in", () => {
    // 11:59:59 pm Dec 31, 2026 in Detroit (EST, UTC-5)
    const lastSecond = new Date("2027-01-01T04:59:59Z");
    assert.equal(semesterOf(lastSecond).name, "Fall 2026");
    assert.equal(rangeBounds("semester", lastSecond).from.toISOString(), "2026-08-15T04:00:00.000Z");
    assert.match(rangeBounds("semester", lastSecond).description, /^Fall 2026 \(since Aug 15\)$/);
    // 12:00:00 am Jan 1, 2027 in Detroit
    const firstSecond = new Date("2027-01-01T05:00:00Z");
    assert.equal(semesterOf(firstSecond).name, "Winter 2027");
    const b = rangeBounds("semester", firstSecond);
    assert.equal(b.from.toISOString(), "2027-01-01T05:00:00.000Z");
    assert.equal(b.to, firstSecond);
    assert.match(b.description, /^Winter 2027 \(since Jan 1\)$/);
    // Nothing is pinned to 2026: a later year rolls the same way.
    assert.equal(semesterOf(new Date("2031-01-01T05:00:00Z")).name, "Winter 2031");
    assert.equal(semesterOf(new Date("2030-12-31T12:00:00Z")).name, "Fall 2030");
  });

  it("builds bounds", () => {
    const now = new Date("2026-11-24T15:00:00Z");
    const r = rangeBounds("30d", now);
    assert.equal(r.to, now);
    assert.equal(now - r.from, 30 * 86_400_000);
    assert.equal(rangeBounds("all", now).from, null);
    assert.match(rangeBounds("semester", now).description, /^Fall 2026 \(since Aug 15\)$/);
  });
});

describe("numbers", () => {
  it("never invents a change", () => {
    assert.equal(percentChange(10, null), null);
    assert.equal(percentChange(10, undefined), null);
    assert.equal(percentChange(10, 0), null);
    assert.equal(percentChange(null, 5), null);
    assert.equal(percentChange(15, 10), 0.5);
    assert.equal(formatChange(0.5), "+50%");
    assert.equal(formatChange(-0.123), "-12%");
  });

  it("summarizes only with real previous data", () => {
    const s = summarize({ ...base, events: [ev(10), ev(20)] });
    assert.deepEqual(s.events, { value: 2, change: null });
    assert.deepEqual(s.checkins, { value: 30, change: null });
    assert.deepEqual(s.average, { value: 15, change: null });
    assert.equal(s.members.change, null);

    const t = summarize({ ...base, events: [ev(10), ev(20)], prev: { events: 1, checkins: 10, members_new: 5 } });
    assert.equal(t.events.change, 1);
    assert.equal(t.checkins.change, 2);
    assert.equal(t.average.change, 0.5);
    assert.equal(t.members.change, 1);

    // A previous period with no events: no event comparisons.
    const u = summarize({ ...base, events: [ev(3)], prev: { events: 0, checkins: 0, members_new: 4 } });
    assert.equal(u.events.change, null);
    assert.equal(u.average.change, null);
    assert.equal(u.members.change, 1.5);

    assert.equal(summarize(base).average.value, null);
  });

  it("show-up rate", () => {
    assert.equal(showUpRate(ev(5, 0, 0)), null);
    assert.equal(showUpRate(ev(5, 4, 3)), 0.75);
  });

  it("running totals", () => {
    assert.deepEqual(
      growthWithTotals({ members_before: 10, growth: [{ month: "2026-09", new_members: 5 }, { month: "2026-10", new_members: 0 }] }).map((g) => g.total),
      [15, 15],
    );
    assert.equal(monthLabel("2026-09"), "Sep '26");
  });

  it("timing in plain English", () => {
    assert.equal(timingSummary(base.timing), null);
    const t = timingSummary({ before_start: 2, min_0_10: 6, min_10_20: 2, min_20_30: 0, min_30_60: 0, min_60_plus: 0, median: 6, p80: 12 });
    assert.equal(t.total, 10);
    assert.equal(t.headline, "Half of check-ins happen by 6 min after the start");
    assert.equal(t.detail, "80% are in by 12 min after the start. 20% checked in before the start time.");
    assert.equal(timingSummary({ ...base.timing, before_start: 3, median: -4, p80: -1 }).headline, "Most people check in before the start");
    assert.equal(formatPercent(0.004), "<1%");
  });
});
