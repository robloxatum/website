// Officer analytics: date ranges and the numbers derived from the database's
// aggregates (public.officer_analytics). No runtime imports: the unit tests
// run this file directly with Node.

export const ANALYTICS_TIME_ZONE = "America/Detroit";

export type AnalyticsRange = "semester" | "30d" | "all";

export const RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: "semester", label: "This semester" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

export function parseRange(value: unknown): AnalyticsRange {
  return value === "30d" || value === "all" ? value : "semester";
}

// ---------------------------------------------------------------------------
// Ranges

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: ANALYTICS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function clockParts(date: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Midnight at the start of a club-time calendar day, as an instant. */
export function clubMidnight(y: number, month: number, day: number): Date {
  const asUtc = Date.UTC(y, month - 1, day);
  const offset = (t: number) => {
    const w = clockParts(new Date(t));
    return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - t;
  };
  let t = asUtc - offset(asUtc);
  t = asUtc - offset(t); // again, in case a DST change sits in between
  return new Date(t);
}

/**
 * The University of Michigan term the date falls in (club time):
 * Winter from Jan 1, Spring/Summer from May 1, Fall from Aug 15.
 */
export function semesterOf(now: Date): { name: string; start: Date } {
  const { y, mo, d } = clockParts(now);
  if (mo > 8 || (mo === 8 && d >= 15)) return { name: `Fall ${y}`, start: clubMidnight(y, 8, 15) };
  if (mo >= 5) return { name: `Spring/Summer ${y}`, start: clubMidnight(y, 5, 1) };
  return { name: `Winter ${y}`, start: clubMidnight(y, 1, 1) };
}

export type RangeBounds = {
  range: AnalyticsRange;
  /** Start (inclusive); null = all time. */
  from: Date | null;
  /** End (exclusive): now. */
  to: Date;
  /** Shown under the title, e.g. "Fall 2026 (since Aug 15)". */
  description: string;
  /** For the "+12 new …" lines, e.g. "this semester". */
  inRange: string;
};

const DAY = 86_400_000;
const shortDate = new Intl.DateTimeFormat("en-US", { timeZone: ANALYTICS_TIME_ZONE, month: "short", day: "numeric" });

export function rangeBounds(range: AnalyticsRange, now: Date): RangeBounds {
  if (range === "30d") {
    const from = new Date(now.getTime() - 30 * DAY);
    return { range, from, to: now, description: `Since ${shortDate.format(from)}`, inRange: "in the last 30 days" };
  }
  if (range === "all") return { range, from: null, to: now, description: "Everything since the club's first event", inRange: "all time" };
  const s = semesterOf(now);
  return { range, from: s.start, to: now, description: `${s.name} (since ${shortDate.format(s.start)})`, inRange: "this semester" };
}

// ---------------------------------------------------------------------------
// Data from public.officer_analytics

export type AnalyticsEvent = {
  id: string;
  title: string;
  starts_at: string;
  category: string;
  cover_path: string | null;
  cover_width: number | null;
  cover_height: number | null;
  checkins: number;
  first_timers: number;
  rsvps: number;
  rsvps_showed: number;
};

export type AnalyticsTiming = {
  before_start: number;
  min_0_10: number;
  min_10_20: number;
  min_20_30: number;
  min_30_60: number;
  min_60_plus: number;
  median: number | null;
  p80: number | null;
};

export type AnalyticsData = {
  members_total: number;
  members_new: number;
  members_before: number;
  checkins_all_time: number;
  events: AnalyticsEvent[];
  by_category: { category: string; checkins: number }[];
  growth: { month: string; new_members: number }[];
  returning: { attendees: number; two_plus: number };
  timing: AnalyticsTiming;
  prev: { events: number; checkins: number; members_new: number } | null;
};

/**
 * Change vs the previous period, as a fraction (0.25 = +25%). Null when there's
 * nothing honest to compare with: no previous period, or it had none.
 */
export function percentChange(current: number | null, previous: number | null | undefined): number | null {
  if (current == null || previous == null || !(previous > 0)) return null;
  return (current - previous) / previous;
}

export function average(total: number, count: number): number | null {
  return count > 0 ? total / count : null;
}

/** Share of RSVPs who checked in; null when nobody RSVP'd. */
export function showUpRate(e: Pick<AnalyticsEvent, "rsvps" | "rsvps_showed">): number | null {
  return e.rsvps > 0 ? e.rsvps_showed / e.rsvps : null;
}

export type StatSummary = {
  members: { total: number; new: number; change: number | null };
  events: { value: number; change: number | null };
  checkins: { value: number; change: number | null };
  average: { value: number | null; change: number | null };
};

export function summarize(d: AnalyticsData): StatSummary {
  const events = d.events.length;
  const checkins = d.events.reduce((n, e) => n + e.checkins, 0);
  const avg = average(checkins, events);
  const p = d.prev;
  // Only compare when the previous period actually had events.
  const prevHasEvents = !!p && p.events > 0;
  return {
    members: { total: d.members_total, new: d.members_new, change: percentChange(d.members_new, p?.members_new) },
    events: { value: events, change: prevHasEvents ? percentChange(events, p.events) : null },
    checkins: { value: checkins, change: prevHasEvents ? percentChange(checkins, p.checkins) : null },
    average: {
      value: avg,
      change: prevHasEvents && p.checkins > 0 ? percentChange(avg, average(p.checkins, p.events)) : null,
    },
  };
}

/** New members per month with the running total (members before the range + everyone since). */
export function growthWithTotals(d: Pick<AnalyticsData, "growth" | "members_before">) {
  let total = d.members_before;
  return d.growth.map((g) => {
    total += g.new_members;
    return { ...g, total };
  });
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
/** "2026-09" -> "Sep '26". */
export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return monthFmt.format(new Date(Date.UTC(y, m - 1, 1))).replace(" ", " '");
}

export const TIMING_BUCKETS: { key: keyof AnalyticsTiming; label: string }[] = [
  { key: "before_start", label: "Before the start" },
  { key: "min_0_10", label: "0–10 min after" },
  { key: "min_10_20", label: "10–20 min" },
  { key: "min_20_30", label: "20–30 min" },
  { key: "min_30_60", label: "30–60 min" },
  { key: "min_60_plus", label: "1 hour+" },
];

function minutesPhrase(m: number) {
  if (m < 0) return `${-m} min before the start`;
  if (m === 0) return "right at the start";
  return `${m} min after the start`;
}

/** Plain-English summary of when people check in, or null with no check-ins. */
export function timingSummary(t: AnalyticsTiming): { total: number; headline: string; detail: string } | null {
  const total = TIMING_BUCKETS.reduce((n, b) => n + (t[b.key] ?? 0), 0);
  if (!total || t.median == null || t.p80 == null) return null;
  const early = t.before_start / total;
  const headline = t.median <= 0 ? "Most people check in before the start" : `Half of check-ins happen by ${minutesPhrase(t.median)}`;
  const parts = [`80% are in by ${minutesPhrase(t.p80)}.`];
  if (t.before_start > 0) parts.push(`${formatPercent(early)} checked in before the start time.`);
  return { total, headline, detail: parts.join(" ") };
}

export function formatPercent(fraction: number) {
  const pct = fraction * 100;
  return `${pct > 0 && pct < 1 ? "<1" : Math.round(pct)}%`;
}

export function formatChange(change: number) {
  const pct = Math.round(change * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}
