// "Add to calendar": an .ics file (Apple Calendar, Outlook, most others) and a
// Google Calendar template link. No runtime imports: the unit tests run this
// file directly with Node.

export const CALENDAR_TIME_ZONE = "America/Detroit";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  /** When the event was last edited; drives SEQUENCE so calendars take the update. */
  updated_at?: string | null;
};

/** Same UID for every download of an event, so re-importing updates the entry instead of adding a copy. */
export function eventUid(id: string) {
  return `event-${id}@robloxatum`;
}

const DESCRIPTION_MAX = 280;

/** A short, plain-text description ending with the event's link. */
export function shortDescription(description: string, url: string) {
  const text = description.trim().replace(/\s+\n/g, "\n");
  const short = text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : text;
  return short ? `${short}\n\nDetails: ${url}` : `Details: ${url}`;
}

/** "20261125T161500" in the club's time zone. */
function localStamp(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CALENDAR_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

/** "20261125T211500Z" (UTC). */
function utcStamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** RFC 5545 text escaping. */
function esc(text: string) {
  // Every kind of line break (CR alone too) becomes an escaped newline: a raw
  // one would let event text start a new calendar property.
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|[\r\n\v\f\u0085\u2028\u2029]/g, "\\n");
}

/** Fold lines longer than 75 octets (continuation lines start with a space), never splitting a character. */
function fold(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines lose one octet to the leading space
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

// America/Detroit (US Eastern) rules since 2007.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${CALENDAR_TIME_ZONE}`,
  `X-LIC-LOCATION:${CALENDAR_TIME_ZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Minutes since 2026-01-01 of the last edit: grows with every edit, so calendars apply the newer version. */
function sequence(updatedAt?: string | null) {
  if (!updatedAt) return 0;
  return Math.max(0, Math.floor((new Date(updatedAt).getTime() - Date.UTC(2026, 0, 1)) / 60000));
}

export function buildIcs(event: CalendarEvent, url: string) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Roblox at UM//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${eventUid(event.id)}`,
    `DTSTAMP:${utcStamp(event.updated_at ?? event.starts_at)}`,
    `SEQUENCE:${sequence(event.updated_at)}`,
    `DTSTART;TZID=${CALENDAR_TIME_ZONE}:${localStamp(event.starts_at)}`,
    `DTEND;TZID=${CALENDAR_TIME_ZONE}:${localStamp(event.ends_at)}`,
    `SUMMARY:${esc(event.title)}`,
    ...(event.location.trim() ? [`LOCATION:${esc(event.location.trim())}`] : []),
    `DESCRIPTION:${esc(shortDescription(event.description, url))}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** Google Calendar "create event" link, prefilled. */
export function googleCalendarUrl(event: CalendarEvent, url: string) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(event.starts_at)}/${utcStamp(event.ends_at)}`,
    ctz: CALENDAR_TIME_ZONE,
    details: shortDescription(event.description, url),
    location: event.location.trim(),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Safe file name for the download. */
export function icsFileName(title: string) {
  const base = title.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  return `${base || "event"}.ics`;
}
