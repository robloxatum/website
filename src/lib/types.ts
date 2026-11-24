export type Profile = {
  id: string;
  uniqname: string;
  full_name: string;
  roblox_username: string | null;
  is_officer: boolean;
  onboarded_at: string | null;
  created_at: string;
};

/** Event fields that are safe to show anyone. */
export type PublicEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
};

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

export type CheckinResult = { status: CheckinStatus; event_title: string | null };

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
