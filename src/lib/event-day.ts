/**
 * "Event day" on the event page: from 2 hours before the start until the end.
 * Then checking in is the main (yellow) action; before that, RSVP is.
 */
export const CHECK_IN_LEAD_MS = 2 * 60 * 60 * 1000;

export function isCheckInTime(e: { starts_at: string; ends_at: string }, now = Date.now()): boolean {
  return new Date(e.starts_at).getTime() - CHECK_IN_LEAD_MS <= now && now < new Date(e.ends_at).getTime();
}
