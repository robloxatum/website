export const CLUB_TIME_ZONE = "America/Detroit";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const longDateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateTimeYearFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
/** "Nov 25, 2026, 3:04 PM" */
export const formatDateTimeWithYear = (iso: string) => dateTimeYearFmt.format(new Date(iso));
export const formatLongDate = (iso: string) => longDateFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

export function formatTimeRange(startIso: string, endIso: string) {
  const sameDay = dateFmt.format(new Date(startIso)) === dateFmt.format(new Date(endIso));
  return sameDay
    ? `${formatTime(startIso)} – ${formatTime(endIso)}`
    : `${formatDateTime(startIso)} – ${formatDateTime(endIso)}`;
}

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function wallClock(date: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Offset of club time from UTC at an instant, in ms (e.g. -5h in winter). */
function offsetMs(date: Date) {
  const w = wallClock(date);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** ISO timestamp -> "YYYY-MM-DDTHH:mm" in club time, for <input type="datetime-local">. */
export function toClubInputValue(iso: string) {
  const w = wallClock(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}`;
}

/** "YYYY-MM-DDTHH:mm" in club time -> ISO timestamp. Returns null if invalid. */
export function fromClubInputValue(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(asUtc)) return null;
  // Apply the offset, then re-check it in case we crossed a DST change.
  let ts = asUtc - offsetMs(new Date(asUtc));
  ts = asUtc - offsetMs(new Date(ts));
  return new Date(ts).toISOString();
}

/** True once the given time has passed (evaluated at request time on the server). */
export function hasPassed(iso: string) {
  return new Date(iso).getTime() <= Date.now();
}
