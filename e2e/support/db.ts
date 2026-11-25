// Test data, written straight to the LOCAL test database with the service-role
// key (seeding only: the app under test never sees this key).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { isLocalUrl } from "../../src/lib/e2e";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.E2E_SERVICE_ROLE_KEY!;
export const PASSWORD = process.env.E2E_TEST_PASSWORD!;

if (!isLocalUrl(url)) throw new Error(`Refusing to seed a non-local Supabase (${url}).`);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
export const admin: SupabaseClient = createClient(url, serviceKey, noSession);

export type TestUser = { id: string; email: string; uniqname: string; fullName: string; nickname: string | null };

/** The fixed users, made by global-setup. */
export const SEEDED = {
  member: "e2e-member",
  member2: "e2e-member2",
  officer: "e2e-officer",
  owner: "e2e-owner",
} as const;

function must<T>(r: { data: T | unknown; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as T;
}

/** A new member (onboarded unless told otherwise). Unique per call. */
export async function createUser(
  opts: { uniqname?: string; fullName?: string; nickname?: string | null; onboarded?: boolean; officer?: boolean; owner?: boolean } = {},
): Promise<TestUser> {
  const uniqname = opts.uniqname ?? `e2e${randomUUID().slice(0, 8)}`;
  const email = `${uniqname}@umich.edu`;
  const fullName = opts.fullName ?? "Test Member";
  const created = must<{ user: { id: string } | null }>(
    await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } }),
    `create ${email}`,
  );
  const id = created.user!.id;
  const patch: Record<string, unknown> = {};
  if (opts.onboarded !== false) patch.onboarded_at = new Date().toISOString();
  if (opts.nickname) patch.nickname = opts.nickname;
  if (opts.officer || opts.owner) patch.is_officer = true;
  if (opts.owner) patch.is_owner = true;
  if (Object.keys(patch).length) must(await admin.from("profiles").update(patch).eq("id", id), `profile ${email}`);
  return { id, email, uniqname, fullName, nickname: opts.nickname ?? null };
}

export async function userByUniqname(uniqname: string): Promise<TestUser> {
  const p = must(
    await admin.from("profiles").select("id, uniqname, full_name, nickname").eq("uniqname", uniqname).single(),
    `find ${uniqname}`,
  ) as { id: string; uniqname: string; full_name: string; nickname: string | null };
  return { id: p.id, email: `${p.uniqname}@umich.edu`, uniqname: p.uniqname, fullName: p.full_name, nickname: p.nickname };
}

/** A Supabase client signed in as this user (for checks through RLS). */
export async function clientAs(user: TestUser): Promise<SupabaseClient> {
  const c = createClient(url, publishable, noSession);
  must(await c.auth.signInWithPassword({ email: user.email, password: PASSWORD }), `sign in ${user.email}`);
  return c;
}

export type TestEvent = { id: string; title: string; code: string; starts_at: string; ends_at: string };

const MIN = 60_000;

/**
 * A new event. Times are minutes from now (default: started 30 min ago, ends
 * in 90: live). Check-in closed unless `open`.
 */
export async function createEvent(
  opts: { title?: string; startMin?: number; endMin?: number; endSec?: number; location?: string; open?: boolean; capacity?: number } = {},
): Promise<TestEvent> {
  const now = Date.now();
  const starts_at = new Date(now + (opts.startMin ?? -30) * MIN).toISOString();
  const ends_at = new Date(opts.endSec !== undefined ? now + opts.endSec * 1000 : now + (opts.endMin ?? 90) * MIN).toISOString();
  const title = opts.title ?? `E2E Event ${randomUUID().slice(0, 6)}`;
  const row = must(
    await admin
      .from("events")
      .insert({ title, location: opts.location ?? "BBB 1670", starts_at, ends_at, checkin_open: !!opts.open, capacity: opts.capacity ?? null, category: "meeting" })
      .select("id")
      .single(),
    `create event ${title}`,
  ) as { id: string };
  return { id: row.id, title, code: await eventCode(row.id), starts_at, ends_at };
}

export async function eventCode(eventId: string): Promise<string> {
  const r = must(await admin.from("event_codes").select("code").eq("event_id", eventId).single(), "event code") as { code: string };
  return r.code;
}

export async function updateEvent(eventId: string, patch: Record<string, unknown>) {
  must(await admin.from("events").update(patch).eq("id", eventId), "update event");
}

export async function checkInAs(user: TestUser, code: string): Promise<string> {
  const c = await clientAs(user);
  const { data, error } = await c.rpc("check_in", { p_code: code });
  if (error) throw new Error(`check_in: ${error.message}`);
  return (data as { status: string }).status;
}

export async function rsvpAs(user: TestUser, eventId: string) {
  const c = await clientAs(user);
  must(await c.from("event_rsvps").insert({ event_id: eventId }), "rsvp");
}

export async function attendanceCount(eventId: string): Promise<number> {
  const { count, error } = await admin.from("attendance").select("*", { count: "exact", head: true }).eq("event_id", eventId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function profile(id: string) {
  return must(await admin.from("profiles").select("*").eq("id", id).single(), "profile") as Record<string, unknown>;
}
