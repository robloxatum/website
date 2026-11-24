import type { OfficerEvent } from "./types";

/** Same rule as public.checkin_is_open() in the database, for live UI updates. */
export function isCheckinOpen(
  e: Pick<OfficerEvent, "checkin_open" | "checkin_reopened" | "ends_at">,
  now = Date.now(),
) {
  return e.checkin_open && (e.checkin_reopened || now < new Date(e.ends_at).getTime());
}

/** Code format: 5 letters, no I or O. */
export const CODE_PATTERN = /^[A-HJ-NP-Z]{5}$/;

export function normalizeCode(input: string) {
  return input.replace(/\s/g, "").toUpperCase();
}
