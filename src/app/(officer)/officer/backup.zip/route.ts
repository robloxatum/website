import { getProfile } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import { makeZip } from "@/lib/zip";

/**
 * Officers: a full backup as a .zip of CSVs (members, events, attendance,
 * RSVPs), so the club has its own copy without a paid Supabase plan. Read as
 * the signed-in officer (RLS). Times are ISO 8601 in UTC so the files can be
 * re-imported; nothing is cached.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;
const PAGE = 1000; // PostgREST returns at most 1000 rows per request

/** Every row, a page at a time (ordered so pages don't overlap). */
async function all<T>(
  supabase: Supabase,
  table: string,
  columns: string,
  order: string[],
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select(columns);
    for (const col of order) q = q.order(col, { ascending: true });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

type Member = {
  id: string;
  uniqname: string;
  full_name: string;
  nickname: string | null;
  roblox_username: string | null;
  roblox_user_id: number | null;
  is_officer: boolean;
  is_owner: boolean;
  created_at: string;
  total_attendance: number;
  last_checked_in_at: string | null;
};
type Event = {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  checkin_open: boolean;
  checkin_reopened: boolean;
  flyer_path: string | null;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
};
type Person = { uniqname: string; full_name: string } | null;
type EventRef = { title: string; starts_at: string } | null;
type Attendance = { event_id: string; user_id: string; checked_in_at: string; events: EventRef; profiles: Person };
type Rsvp = { event_id: string; user_id: string; created_at: string; events: EventRef; profiles: Person };

export async function GET() {
  const profile = await getProfile();
  if (!profile?.is_officer) return new Response("Officers only", { status: 403 });

  const supabase = await createClient();
  let members: Member[], events: Event[], attendance: Attendance[], rsvps: Rsvp[];
  try {
    [members, events, attendance, rsvps] = await Promise.all([
      all<Member>(
        supabase,
        "member_attendance",
        "id, uniqname, full_name, nickname, roblox_username, roblox_user_id, is_officer, is_owner, created_at, total_attendance, last_checked_in_at",
        ["created_at", "id"],
      ),
      all<Event>(
        supabase,
        "events",
        "id, title, description, location, category, starts_at, ends_at, capacity, checkin_open, checkin_reopened, flyer_path, cover_path, created_at, updated_at",
        ["starts_at", "id"],
      ),
      all<Attendance>(
        supabase,
        "attendance",
        "event_id, user_id, checked_in_at, events(title, starts_at), profiles(uniqname, full_name)",
        ["checked_in_at", "event_id", "user_id"],
      ),
      all<Rsvp>(
        supabase,
        "event_rsvps",
        "event_id, user_id, created_at, events(title, starts_at), profiles(uniqname, full_name)",
        ["created_at", "event_id", "user_id"],
      ),
    ]);
  } catch (err) {
    // No partial backups: a missing table would look like lost data.
    console.error("Backup failed", err instanceof Error ? err.message : err);
    return new Response("Couldn't build the backup. Please try again.", { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  const files = [
    {
      name: "members.csv",
      data: toCsv([
        ["id", "name", "nickname", "uniqname", "email", "roblox_username", "roblox_user_id", "officer", "owner", "events_attended", "last_checked_in_at", "joined_at"],
        ...members.map((m) => [
          m.id, m.full_name, m.nickname, m.uniqname, `${m.uniqname}@umich.edu`, m.roblox_username, m.roblox_user_id,
          m.is_officer ? "yes" : "no", m.is_owner ? "yes" : "no", m.total_attendance, m.last_checked_in_at, m.created_at,
        ]),
      ]),
    },
    {
      name: "events.csv",
      data: toCsv([
        ["id", "title", "category", "starts_at", "ends_at", "location", "capacity", "description", "checkin_open", "checkin_reopened", "flyer_path", "cover_path", "created_at", "updated_at"],
        ...events.map((e) => [
          e.id, e.title, e.category, e.starts_at, e.ends_at, e.location, e.capacity, e.description,
          e.checkin_open ? "yes" : "no", e.checkin_reopened ? "yes" : "no", e.flyer_path, e.cover_path, e.created_at, e.updated_at,
        ]),
      ]),
    },
    {
      name: "attendance.csv",
      data: toCsv([
        ["event_id", "event_title", "event_starts_at", "user_id", "uniqname", "name", "checked_in_at"],
        ...attendance.map((a) => [
          a.event_id, a.events?.title, a.events?.starts_at, a.user_id, a.profiles?.uniqname, a.profiles?.full_name, a.checked_in_at,
        ]),
      ]),
    },
    {
      name: "rsvps.csv",
      data: toCsv([
        ["event_id", "event_title", "event_starts_at", "user_id", "uniqname", "name", "rsvped_at"],
        ...rsvps.map((r) => [
          r.event_id, r.events?.title, r.events?.starts_at, r.user_id, r.profiles?.uniqname, r.profiles?.full_name, r.created_at,
        ]),
      ]),
    },
    {
      name: "README.txt",
      data: [
        "Roblox at UM: full backup",
        `Made ${now.toISOString()} by ${profile.uniqname}.`,
        "",
        `members.csv     ${members.length} members`,
        `events.csv      ${events.length} events`,
        `attendance.csv  ${attendance.length} check-ins`,
        `rsvps.csv       ${rsvps.length} RSVPs`,
        "",
        "Times are ISO 8601 in UTC. Files are UTF-8 CSV. Contains members' names and",
        "umich.edu emails: keep it somewhere only officers can open, and delete old copies.",
        "",
      ].join("\r\n"),
    },
  ];
  // BOM so Excel reads the CSVs as UTF-8 (same as the other exports).
  const zip = makeZip(files.map((f) => (f.name.endsWith(".csv") ? { ...f, data: `﻿${f.data}` } : f)), now);

  return new Response(zip as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="roblox-at-um-backup-${stamp}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
