export type Profile = {
  id: string;
  uniqname: string;
  full_name: string;
  roblox_username: string | null;
  is_officer: boolean;
  onboarded_at: string | null;
  created_at: string;
};

export type EventCategory = "game_night" | "workshop" | "game_jam" | "social" | "meeting" | "partner";

/** Event fields that are safe to show anyone. */
export type PublicEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  category: EventCategory;
  capacity: number | null;
};

export type EventStatus = "upcoming" | "live" | "completed";

/** A public event with its status and (past events only) aggregate attendance. */
export type ListedEvent = PublicEvent & { status: EventStatus; attendance: number | null };

export type PublicStats = { members: number; events_held: number; total_checkins: number };

/** Event as officers see it, including check-in state. */
export type OfficerEvent = PublicEvent & {
  checkin_open: boolean;
  checkin_reopened: boolean;
  checkin_is_open: boolean;
};

export type CheckinStatus =
  | "ok"
  | "already_checked_in"
  | "closed"
  | "invalid_code"
  | "rate_limited"
  | "not_signed_in"
  | "not_umich"
  | "no_profile"
  | "error";

export type CheckinEvent = Pick<PublicEvent, "id" | "title" | "starts_at" | "ends_at" | "location" | "category">;

export type CheckinResult = {
  status: CheckinStatus;
  event_title: string | null;
  /** Public details of the event the code belongs to (never the code). */
  event?: CheckinEvent | null;
};

export type MemberRow = {
  id: string;
  uniqname: string;
  full_name: string;
  roblox_username: string | null;
  is_officer: boolean;
  created_at: string;
  total_attendance: number;
  last_checked_in_at: string | null;
};
