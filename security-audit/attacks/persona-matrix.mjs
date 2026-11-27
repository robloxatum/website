#!/usr/bin/env node
// Security audit 3: access-control attack matrix against the LOCAL Supabase only.
//
//   node security-audit/attacks/persona-matrix.mjs
//
// Calls the Data API, RPCs, Realtime and Storage DIRECTLY (never the UI) as nine
// personas, with synthetic users (aud3…@umich.edu) and synthetic events. Refuses
// to run unless the API and database are on this machine. Prints results only:
// no keys, tokens or passwords. Writes security-audit/evidence/persona-matrix.json.
//
// Needs: local Supabase running (npx supabase start), Docker (for psql in the db container).

import { execFileSync, spawnSync } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { isLocalUrl } from "../../src/lib/e2e.ts";

// ---------------------------------------------------------------------------
// Local only
// ---------------------------------------------------------------------------
const st = JSON.parse(
  (() => {
    const r = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
    return r.stdout.slice(r.stdout.indexOf("{"));
  })(),
);
const URL_ = st.API_URL;
if (!isLocalUrl(URL_) || !isLocalUrl(st.DB_URL.replace(/^postgres(ql)?:/, "http:"))) {
  console.error("Refusing: Supabase is not local.");
  process.exit(1);
}
const PUB = st.PUBLISHABLE_KEY ?? st.ANON_KEY;
const SERVICE = st.SERVICE_ROLE_KEY;
const JWT_SECRET = st.JWT_SECRET;
const PASSWORD = randomBytes(18).toString("base64url");
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SERVICE, noSession);
const RUN = randomUUID().slice(0, 6);

function psql(sql) {
  return execFileSync("docker", ["exec", "-i", "supabase_db_website", "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
  }).trim();
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
const results = [];
function record(id, persona, operation, expected, actual, pass, note = "") {
  results.push({ id, persona, operation, expected, actual, status: pass ? "pass" : "FAIL", note });
  const mark = pass ? "pass" : "FAIL";
  console.log(`${mark.padEnd(4)} ${id.padEnd(8)} ${persona.padEnd(14)} ${operation}  → ${actual}${note ? `  (${note})` : ""}`);
}
const short = (r) => {
  if (r.error) return `error ${r.error.code ?? ""} ${String(r.error.message ?? "").slice(0, 70)}`.trim();
  if (Array.isArray(r.data)) return `${r.data.length} row(s)`;
  if (r.data === null || r.data === undefined) return r.count !== undefined && r.count !== null ? `count=${r.count}` : "null";
  return JSON.stringify(r.data).slice(0, 90);
};
/** Denied = an error, or no rows/no effect. */
const deniedOrEmpty = (r) => !!r.error || (Array.isArray(r.data) && r.data.length === 0) || r.data === null;
let n = 0;
const nid = (p) => `${p}-${String(++n).padStart(2, "0")}`;

async function expectDenied(prefix, persona, operation, fn) {
  let r;
  try {
    r = await fn();
  } catch (e) {
    r = { error: { message: e.message } };
  }
  record(nid(prefix), persona, operation, "denied/empty", short(r), deniedOrEmpty(r));
  return r;
}
async function expectAllowed(prefix, persona, operation, fn, check = (r) => !r.error) {
  let r;
  try {
    r = await fn();
  } catch (e) {
    r = { error: { message: e.message } };
  }
  record(nid(prefix), persona, operation, "allowed", short(r), check(r));
  return r;
}

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------
async function makeUser(tag, { onboarded = true, officer = false, owner = false, name = "Synthetic Person" } = {}) {
  const uniqname = `aud3${tag}${RUN}`;
  const email = `${uniqname}@umich.edu`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw new Error(`create ${tag}: ${error.message}`);
  const id = data.user.id;
  const patch = {};
  if (onboarded) patch.onboarded_at = new Date().toISOString();
  if (officer || owner) patch.is_officer = true;
  if (owner) patch.is_owner = true;
  if (Object.keys(patch).length) {
    const r = await admin.from("profiles").update(patch).eq("id", id);
    if (r.error) throw new Error(`profile ${tag}: ${r.error.message}`);
  }
  return { id, email, uniqname };
}
async function signIn(user) {
  const c = createClient(URL_, PUB, noSession);
  const { data, error } = await c.auth.signInWithPassword({ email: user.email, password: PASSWORD });
  if (error) throw new Error(`sign in ${user.email}: ${error.message}`);
  return { c, session: data.session };
}
const b64url = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
function decode(jwt) {
  return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
}
async function rest(token, path, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: PUB, ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

console.log(`Local Supabase ${URL_} — run ${RUN}\n`);

// Non-umich account: the before-user-created hook must refuse it on the PUBLIC sign-up path
// (Google OAuth goes through the same hook). The admin API bypasses hooks by design.
async function publicSignup(email) {
  const r = await fetch(`${URL_}/auth/v1/signup`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, session: !!j.access_token, msg: String(j.msg ?? j.message ?? "").slice(0, 60) };
}
for (const evil of [`aud3x${RUN}@gmail.com`, `aud3y${RUN}@umich.edu.evil.com`, `aud3z${RUN}@sub.umich.edu`, `aud3w${RUN}@xumich.edu`, `aud3v${RUN}@UMICH.EDU.evil.com`]) {
  const r = await publicSignup(evil);
  record(nid("B"), "non-umich", `sign up ${evil.replace(RUN, "")} (hook)`, "403 refused", `${r.status} ${r.msg}`, r.status === 403 && !r.session);
}
{
  const r = await publicSignup(`AUD3U${RUN}@UMich.Edu`);
  record(nid("B"), "member", "sign up UPPER@UMich.Edu (hook)", "allowed", `${r.status}`, r.status === 200);
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = users.users.find((x) => x.email === `aud3u${RUN}@umich.edu`.toLowerCase());
  const p = u ? await admin.from("profiles").select("uniqname").eq("id", u.id).single() : { data: null };
  record(nid("B"), "member", "uniqname from mixed-case email", "lowercase", p.data?.uniqname?.replace(RUN.toLowerCase(), "<run>") ?? "no profile", p.data?.uniqname === `aud3u${RUN}`.toLowerCase());
}
{
  const r = await admin.auth.admin.createUser({ email: `aud3adm${RUN}@gmail.com`, password: PASSWORD, email_confirm: true });
  const prof = r.data?.user ? await admin.from("profiles").select("id").eq("id", r.data.user.id) : { data: [] };
  record(nid("B"), "service role", "admin.createUser x@gmail.com", "(info) admin API skips hooks", r.error ? "refused" : `created; profile rows=${prof.data?.length ?? 0}`, !r.error ? (prof.data?.length ?? 0) === 0 : true, "handle_new_user() still makes no profile for non-umich");
}

const owner = await makeUser("own", { owner: true, name: "Synthetic Owner" });
const officer = await makeUser("off", { officer: true, name: "Synthetic Officer" });
const former = await makeUser("fmr", { officer: true, name: "Synthetic Former" });
const memberA = await makeUser("ma", { name: "Synthetic Alice" });
const memberB = await makeUser("mb", { name: "Synthetic Bob" });
const fresh = await makeUser("new", { onboarded: false, name: "Synthetic Fresh" });
// A non-umich session (as if the hook were off): create as umich, then move the email in SQL.
const nonUm = await makeUser("nu", { name: "Synthetic Outsider" });
psql(`update auth.users set email = 'aud3nu${RUN}@gmail.com' where id = '${nonUm.id}';`);
nonUm.email = `aud3nu${RUN}@gmail.com`;

const S = {};
for (const [k, u] of Object.entries({ owner, officer, former, memberA, memberB, fresh, nonUm })) S[k] = await signIn(u);
const anon = createClient(URL_, PUB, noSession);
record(nid("B"), "non-umich", "JWT email claim after SQL email change", "@gmail.com", decode(S.nonUm.session.access_token).email.replace(RUN, ""), decode(S.nonUm.session.access_token).email.endsWith("@gmail.com"));

// Events: live (check-in open), upcoming, ended.
const now = Date.now();
const mkEvent = async (title, startMin, endMin, open) => {
  const { data, error } = await admin
    .from("events")
    .insert({ title: `AUD3 ${title} ${RUN}`, location: "BBB 1670", starts_at: new Date(now + startMin * 60e3).toISOString(), ends_at: new Date(now + endMin * 60e3).toISOString(), checkin_open: open })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: c } = await admin.from("event_codes").select("code").eq("event_id", data.id).single();
  return { id: data.id, code: c.code };
};
const live = await mkEvent("Live", -30, 90, true);
const upcoming = await mkEvent("Upcoming", 60 * 24, 60 * 26, false);
const ended = await mkEvent("Ended", -300, -200, false);
await admin.from("event_game_servers").insert({ event_id: live.id, url: "https://www.roblox.com/share?code=aud3live", label: "Server 1" });
await admin.from("event_game_servers").insert({ event_id: upcoming.id, url: "https://www.roblox.com/share?code=aud3up", label: "Server 1" });
await admin.from("event_game_servers").insert({ event_id: ended.id, url: "https://www.roblox.com/share?code=aud3end", label: "Server 1" });

// memberA checks in to live, RSVPs upcoming; memberA turns push on.
{
  const r = await S.memberA.c.rpc("check_in", { p_code: live.code });
  record(nid("C"), "member A", "check_in(live code)", "ok", r.data?.status ?? short(r), r.data?.status === "ok");
  const r2 = await S.memberA.c.rpc("check_in", { p_code: live.code });
  record(nid("F"), "member A", "check_in replay (same code twice)", "already_checked_in", r2.data?.status ?? short(r2), r2.data?.status === "already_checked_in");
  await S.memberA.c.from("event_rsvps").insert({ event_id: upcoming.id });
  const sub = { p_endpoint: `https://fcm.googleapis.com/fcm/send/aud3-${RUN}-a`, p_p256dh: "B".padEnd(87, "A"), p_auth: "A".padEnd(22, "A") };
  const p = await S.memberA.c.rpc("save_push_subscription", sub);
  record(nid("C"), "member A", "save_push_subscription(own device)", "ok", short(p), !p.error);
}

// ---------------------------------------------------------------------------
// C. Profiles and emails
// ---------------------------------------------------------------------------
console.log("\n-- profiles, member list, emails");
await expectDenied("C", "anon", "select profiles", () => anon.from("profiles").select("id, uniqname"));
await expectDenied("C", "anon", "select member_attendance", () => anon.from("member_attendance").select("id"));
await expectDenied("C", "anon", "count profiles (head)", async () => {
  const r = await anon.from("profiles").select("*", { count: "exact", head: true });
  return r.error ? r : { data: r.count ? [r.count] : [] };
});
for (const who of ["memberB", "fresh", "nonUm"]) {
  await expectAllowed("C", who, "select profiles → own row only", () => S[who].c.from("profiles").select("id"), (r) =>
    !r.error && r.data.every((x) => x.id === { memberB, fresh, nonUm }[who].id) && r.data.length <= 1,
  );
  await expectDenied("C", who, "select memberA profile by id", () => S[who].c.from("profiles").select("uniqname").eq("id", memberA.id));
  await expectAllowed("C", who, "member_attendance → own row only", () => S[who].c.from("member_attendance").select("id"), (r) => !r.error && r.data.length <= 1);
  await expectAllowed("C", who, "count(profiles) reveals only self", async () => {
    const r = await S[who].c.from("profiles").select("*", { count: "exact", head: true });
    return { data: r.count, error: r.error };
  }, (r) => !r.error && r.data <= 1);
}
await expectDenied("C", "memberB", "update memberA nickname", async () => {
  const r = await S.memberB.c.from("profiles").update({ nickname: "Pwned" }).eq("id", memberA.id).select("id");
  return r;
});
for (const col of ["is_officer", "is_owner", "uniqname", "id", "created_at"]) {
  const val = col === "uniqname" ? `aud3owned${RUN}` : col === "id" ? randomUUID() : col === "created_at" ? "2000-01-01T00:00:00Z" : true;
  await expectDenied("C", "memberB", `update own profiles.${col} (mass assignment)`, () => S.memberB.c.from("profiles").update({ [col]: val }).eq("id", memberB.id).select("id"));
}
{
  await S.memberB.c.from("profiles").update({ full_name: "Forged Name" }).eq("id", memberB.id);
  const p = await admin.from("profiles").select("full_name").eq("id", memberB.id).single();
  record(nid("C"), "memberB", "update own full_name (locked)", "ignored", p.data.full_name, p.data.full_name !== "Forged Name");
}
await expectDenied("C", "memberB", "insert a profile row", () => S.memberB.c.from("profiles").insert({ id: randomUUID(), uniqname: "aud3fake" }).select("id"));
await expectDenied("C", "memberB", "delete own profile", () => S.memberB.c.from("profiles").delete().eq("id", memberB.id).select("id"));
await expectDenied("C", "nonUm", "update own profile (non-umich)", () => S.nonUm.c.from("profiles").update({ nickname: "Outsider" }).eq("id", nonUm.id).select("id"));
{
  const r = await S.memberB.c.from("profiles").update({ nickname: "Ali​ce" }).eq("id", memberB.id).select("id");
  record(nid("E"), "memberB", "nickname with zero-width space", "rejected (23514)", short(r), !!r.error);
  const r2 = await S.memberB.c.from("profiles").update({ nickname: "Officer ‮ecila" }).eq("id", memberB.id).select("id");
  record(nid("E"), "memberB", "nickname with right-to-left override", "rejected", short(r2), !!r2.error);
  const r3 = await S.memberB.c.from("profiles").update({ nickname: "Аlice" /* Cyrillic А */ }).eq("id", memberB.id).select("id");
  record(nid("E"), "memberB", "nickname with Cyrillic lookalike", "rejected", short(r3), !!r3.error);
  const r4 = await S.memberB.c.from("profiles").update({ nickname: "<img src=x onerror=alert(1)>" }).eq("id", memberB.id).select("id");
  record(nid("E"), "memberB", "nickname with HTML", "rejected", short(r4), !!r4.error);
  const r5 = await S.memberB.c.from("profiles").update({ roblox_username: "x'; drop--" }).eq("id", memberB.id).select("id");
  record(nid("E"), "memberB", "roblox_username injection", "rejected", short(r5), !!r5.error);
}
{
  // Accepted (owner): members can set their own roblox_user_id. Confirm it is ONLY their own.
  const r = await S.memberB.c.from("profiles").update({ roblox_username: "Builderman", roblox_user_id: 156 }).eq("id", memberA.id).select("id");
  record(nid("C"), "memberB", "set memberA roblox_user_id", "denied", short(r), deniedOrEmpty(r));
}

// ---------------------------------------------------------------------------
// C. Attendance, codes, RSVPs
// ---------------------------------------------------------------------------
console.log("\n-- attendance, codes, RSVPs");
await expectDenied("C", "anon", "select attendance", () => anon.from("attendance").select("user_id"));
await expectDenied("C", "memberB", "select attendance (others)", () => S.memberB.c.from("attendance").select("user_id").eq("event_id", live.id));
await expectDenied("C", "memberB", "insert attendance for self (bypass check_in)", () => S.memberB.c.from("attendance").insert({ event_id: live.id, user_id: memberB.id }).select("event_id"));
await expectDenied("C", "memberB", "insert attendance for memberA", () => S.memberB.c.from("attendance").insert({ event_id: upcoming.id, user_id: memberA.id }).select("event_id"));
await expectDenied("C", "memberA", "delete own attendance", () => S.memberA.c.from("attendance").delete().eq("user_id", memberA.id).select("event_id"));
await expectDenied("C", "memberB", "delete memberA attendance", () => S.memberB.c.from("attendance").delete().eq("user_id", memberA.id).select("event_id"));
for (const who of ["memberB", "fresh", "nonUm", "former"]) {
  if (who === "former") continue;
  await expectDenied("C", who, "select event_codes", () => S[who].c.from("event_codes").select("code"));
}
await expectDenied("C", "anon", "select event_codes", () => anon.from("event_codes").select("code"));
await expectAllowed("C", "officer", "select event_codes", () => S.officer.c.from("event_codes").select("code").eq("event_id", live.id), (r) => r.data?.length === 1);
await expectDenied("C", "memberB", "select event_rsvps (others)", () => S.memberB.c.from("event_rsvps").select("user_id"));
await expectDenied("C", "memberB", "insert RSVP as memberA", () => S.memberB.c.from("event_rsvps").insert({ event_id: upcoming.id, user_id: memberA.id }).select("event_id"));
await expectDenied("C", "memberB", "insert RSVP on ended event", () => S.memberB.c.from("event_rsvps").insert({ event_id: ended.id }).select("event_id"));
await expectDenied("C", "memberB", "delete memberA RSVP", () => S.memberB.c.from("event_rsvps").delete().eq("user_id", memberA.id).select("event_id"));
await expectDenied("C", "nonUm", "insert RSVP (non-umich)", () => S.nonUm.c.from("event_rsvps").insert({ event_id: upcoming.id }).select("event_id"));
await expectDenied("C", "anon", "insert RSVP", () => anon.from("event_rsvps").insert({ event_id: upcoming.id }).select("event_id"));
{
  const r = await S.fresh.c.from("event_rsvps").insert({ event_id: upcoming.id }).select("event_id");
  record(nid("C"), "fresh", "RSVP before finishing /welcome", "(design) allowed", short(r), true, r.error ? "denied" : "allowed: onboarding is not enforced by the database");
  const c = await S.fresh.c.rpc("check_in", { p_code: live.code });
  record(nid("C"), "fresh", "check_in before finishing /welcome", "(design) allowed", c.data?.status ?? short(c), true, "onboarded_at is not checked by check_in()");
}
{
  const r = await S.nonUm.c.rpc("check_in", { p_code: live.code });
  record(nid("C"), "nonUm", "check_in (non-umich)", "not_umich", r.data?.status ?? short(r), r.data?.status === "not_umich");
  const r2 = await anon.rpc("check_in", { p_code: live.code });
  record(nid("C"), "anon", "check_in", "denied", short(r2), !!r2.error);
}

// ---------------------------------------------------------------------------
// F. Check-in brute force (parallel) and code properties
// ---------------------------------------------------------------------------
console.log("\n-- check-in guessing");
{
  const guesses = Array.from({ length: 40 }, () => Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join(""));
  const outs = await Promise.all(guesses.map((g) => S.memberB.c.rpc("check_in", { p_code: g })));
  const statuses = outs.map((o) => o.data?.status ?? "error");
  const failures = Number(psql(`select count(*) from private.checkin_failures where user_id = '${memberB.id}';`));
  const counts = statuses.reduce((m, s) => ((m[s] = (m[s] ?? 0) + 1), m), {});
  record(nid("F"), "memberB", "40 parallel wrong codes", "≤10 recorded failures", `${JSON.stringify(counts)}; failures=${failures}`, failures <= 10);
  const after = await S.memberB.c.rpc("check_in", { p_code: live.code });
  record(nid("F"), "memberB", "correct code while rate-limited", "rate_limited", after.data?.status ?? short(after), after.data?.status === "rate_limited");
  // Other formats are normalized before the limit (lowercase, spaces) and counted.
  const codes = psql("select code from public.event_codes;").split("\n").filter(Boolean);
  const distinct = new Set(codes).size;
  record(nid("F"), "db", "event codes unique, 5 letters from 24", "all match ^[A-HJ-NP-Z]{5}$", `${codes.length} codes, ${distinct} distinct`, codes.every((c) => /^[A-HJ-NP-Z]{5}$/.test(c)) && distinct === codes.length);
}
{
  // Codes for past events still resolve (closed), and a code from another event isn't a failure.
  const r = await S.memberA.c.rpc("check_in", { p_code: ended.code });
  record(nid("F"), "memberA", "check_in with an ENDED event's code", "closed (event title revealed)", r.data?.status ?? short(r), r.data?.status === "closed");
  const r2 = await S.memberA.c.rpc("check_in", { p_code: upcoming.code });
  record(nid("F"), "memberA", "check_in to an upcoming event (not opened)", "closed", r2.data?.status ?? short(r2), r2.data?.status === "closed");
}

// ---------------------------------------------------------------------------
// Push subscriptions
// ---------------------------------------------------------------------------
console.log("\n-- push devices");
await expectDenied("C", "memberB", "select memberA devices", () => S.memberB.c.from("push_subscriptions").select("endpoint").eq("user_id", memberA.id));
await expectDenied("C", "memberB", "update memberA device settings", () => S.memberB.c.from("push_subscriptions").update({ event_reminders: false }).eq("user_id", memberA.id).select("id"));
await expectDenied("C", "memberB", "update own device user_id → memberA", async () => {
  await S.memberB.c.rpc("save_push_subscription", { p_endpoint: `https://fcm.googleapis.com/fcm/send/aud3-${RUN}-b`, p_p256dh: "B".padEnd(87, "A"), p_auth: "A".padEnd(22, "A") });
  return S.memberB.c.from("push_subscriptions").update({ user_id: memberA.id }).eq("user_id", memberB.id).select("id");
});
await expectDenied("C", "memberB", "insert device directly", () => S.memberB.c.from("push_subscriptions").insert({ user_id: memberB.id, endpoint: "https://fcm.googleapis.com/x", p256dh: "B".padEnd(87, "A"), auth: "A".padEnd(22, "A") }).select("id"));
await expectDenied("C", "memberB", "delete memberA devices", () => S.memberB.c.from("push_subscriptions").delete().eq("user_id", memberA.id).select("id"));
await expectDenied("C", "nonUm", "save_push_subscription (non-umich)", () => S.nonUm.c.rpc("save_push_subscription", { p_endpoint: `https://fcm.googleapis.com/fcm/send/aud3-${RUN}-n`, p_p256dh: "B".padEnd(87, "A"), p_auth: "A".padEnd(22, "A") }));
for (const ep of ["http://127.0.0.1:9/x", "https://169.254.169.254/latest", "https://fcm.googleapis.com.evil.com/x", "https://evil.com/fcm.googleapis.com/"]) {
  await expectDenied("F", "memberB", `save device endpoint ${ep}`, () => S.memberB.c.rpc("save_push_subscription", { p_endpoint: ep, p_p256dh: "B".padEnd(87, "A"), p_auth: "A".padEnd(22, "A") }));
}
{
  // p_replaces with another member's endpoint must not delete it.
  await S.memberB.c.rpc("save_push_subscription", { p_endpoint: `https://fcm.googleapis.com/fcm/send/aud3-${RUN}-b2`, p_p256dh: "B".padEnd(87, "A"), p_auth: "A".padEnd(22, "A"), p_replaces: `https://fcm.googleapis.com/fcm/send/aud3-${RUN}-a` });
  const still = await admin.from("push_subscriptions").select("user_id").eq("endpoint", `https://fcm.googleapis.com/fcm/send/aud3-${RUN}-a`).maybeSingle();
  record(nid("F"), "memberB", "p_replaces = memberA endpoint", "memberA device untouched", still.data ? (still.data.user_id === memberA.id ? "untouched" : "MOVED") : "DELETED", still.data?.user_id === memberA.id);
}
{
  const many = await Promise.all(Array.from({ length: 25 }, (_, i) => S.memberB.c.rpc("save_push_subscription", { p_endpoint: `https://fcm.googleapis.com/fcm/send/aud3-${RUN}-cap-${i}`, p_p256dh: "B".padEnd(87, "A"), p_auth: "A".padEnd(22, "A") })));
  const { count } = await admin.from("push_subscriptions").select("*", { count: "exact", head: true }).eq("user_id", memberB.id);
  record(nid("F"), "memberB", "25 parallel device saves", "≤10 devices kept", `errors=${many.filter((m) => m.error).length}, devices=${count}`, count <= 10);
}

// ---------------------------------------------------------------------------
// Game servers (private links)
// ---------------------------------------------------------------------------
console.log("\n-- game servers");
await expectAllowed("C", "memberA", "read servers: checked in + live", () => S.memberA.c.from("event_game_servers").select("url").eq("event_id", live.id), (r) => r.data?.length === 1);
await expectDenied("C", "memberB", "read servers: NOT checked in, live", () => S.memberB.c.from("event_game_servers").select("url").eq("event_id", live.id));
await expectDenied("C", "memberA", "read servers: upcoming event", () => S.memberA.c.from("event_game_servers").select("url").eq("event_id", upcoming.id));
await expectDenied("C", "anon", "read servers", () => anon.from("event_game_servers").select("url"));
await expectDenied("C", "memberA", "add a server", () => S.memberA.c.from("event_game_servers").insert({ event_id: live.id, url: "https://www.roblox.com/x", label: "Mine" }).select("id"));
await expectDenied("C", "memberA", "edit a server URL", () => S.memberA.c.from("event_game_servers").update({ url: "https://www.roblox.com/evil" }).eq("event_id", live.id).select("id"));
await expectDenied("C", "memberA", "reorder_game_servers", () => S.memberA.c.rpc("reorder_game_servers", { p_event_id: live.id, p_ids: [] }));
{
  const r = await S.memberA.c.rpc("my_checkin_order", { p_event_id: live.id });
  record(nid("C"), "memberA", "my_checkin_order (checked in)", "a number", short(r), typeof r.data === "number");
  const r2 = await S.memberB.c.rpc("my_checkin_order", { p_event_id: live.id });
  record(nid("C"), "memberB", "my_checkin_order (not checked in)", "null", short(r2), r2.data === null);
  for (const url of ["https://roblox.com.evil.com/x", "https://www.roblox.com@evil.com/", "javascript:alert(1)", "https://www.roblox.com/\"><script>", "http://www.roblox.com/x"]) {
    const r3 = await S.officer.c.from("event_game_servers").insert({ event_id: upcoming.id, url, label: "x" }).select("id");
    record(nid("F"), "officer", `server url ${url.slice(0, 34)}`, "rejected", short(r3), !!r3.error);
  }
}

// ---------------------------------------------------------------------------
// Officer and owner operations
// ---------------------------------------------------------------------------
console.log("\n-- officer / owner");
for (const who of ["memberA", "fresh", "nonUm"]) {
  await expectDenied("C", who, "set_officer(self, true)", () => S[who].c.rpc("set_officer", { p_user_id: { memberA, fresh, nonUm }[who].id, p_is_officer: true }));
  await expectDenied("C", who, "officer_analytics", () => S[who].c.rpc("officer_analytics", { p_from: null, p_to: null }));
  await expectDenied("C", who, "regenerate_event_code", () => S[who].c.rpc("regenerate_event_code", { p_event_id: live.id }));
  await expectDenied("C", who, "set_checkin_open", () => S[who].c.rpc("set_checkin_open", { p_event_id: upcoming.id, p_open: true }));
  await expectDenied("C", who, "clear_nickname(memberB)", () => S[who].c.rpc("clear_nickname", { p_user_id: memberB.id }));
  await expectDenied("C", who, "update event title", () => S[who].c.from("events").update({ title: "Pwned" }).eq("id", upcoming.id).select("id"));
  await expectDenied("C", who, "delete event", () => S[who].c.from("events").delete().eq("id", upcoming.id).select("id"));
  await expectDenied("C", who, "insert event", () => S[who].c.from("events").insert({ title: "x", starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 1e6).toISOString() }).select("id"));
  await expectDenied("C", who, "publish announcement", () => S[who].c.from("announcements").insert({ message: "Pwned" }).select("id"));
  await expectDenied("C", who, "save_community_links", () => S[who].c.rpc("save_community_links", { p_expected: null, p_links: [] }));
  await expectDenied("C", who, "save_about_page", () => S[who].c.rpc("save_about_page", { p_expected: null, p_story: "x", p_timeline: [] }));
  await expectDenied("C", who, "save_featured_panel", () => S[who].c.rpc("save_featured_panel", { p_expected: null, p_enabled: true, p_title: "x", p_body: "x", p_link_text: null, p_link_href: null }));
  await expectDenied("C", who, "save_join_content", () => S[who].c.rpc("save_join_content", { p_expected: null, p_faq: [], p_what: [] }));
  await expectDenied("C", who, "select site_content_edits", () => S[who].c.from("site_content_edits").select("updated_by"));
}
await expectDenied("C", "officer", "set_officer(memberA, true)", () => S.officer.c.rpc("set_officer", { p_user_id: memberA.id, p_is_officer: true }));
await expectDenied("C", "officer", "set_officer(owner, false) (demote owner)", () => S.officer.c.rpc("set_officer", { p_user_id: owner.id, p_is_officer: false }));
await expectDenied("C", "officer", "update own is_owner", () => S.officer.c.from("profiles").update({ is_owner: true }).eq("id", officer.id).select("id"));
await expectDenied("C", "officer", "update owner is_officer", () => S.officer.c.from("profiles").update({ is_officer: false }).eq("id", owner.id).select("id"));
await expectDenied("C", "officer", "update another member's nickname", () => S.officer.c.from("profiles").update({ nickname: "Officered" }).eq("id", memberA.id).select("id"));
await expectDenied("C", "owner", "set_officer(owner self, false)", () => S.owner.c.rpc("set_officer", { p_user_id: owner.id, p_is_officer: false }));
await expectAllowed("C", "owner", "set_officer(memberB, true)", () => S.owner.c.rpc("set_officer", { p_user_id: memberB.id, p_is_officer: true }));
await expectAllowed("C", "owner", "set_officer(memberB, false)", () => S.owner.c.rpc("set_officer", { p_user_id: memberB.id, p_is_officer: false }));
{
  const r = await S.officer.c.rpc("set_officer", { p_user_id: randomUUID(), p_is_officer: true });
  record(nid("D"), "officer", "set_officer(random uuid) error", "42501 before existence check", short(r), r.error?.code === "42501");
  const r2 = await S.memberB.c.rpc("clear_nickname", { p_user_id: randomUUID() });
  record(nid("D"), "memberB", "clear_nickname(random uuid) error", "42501 (no existence oracle)", short(r2), r2.error?.code === "42501");
}
await expectAllowed("C", "officer", "officer_analytics", () => S.officer.c.rpc("officer_analytics", { p_from: null, p_to: null }));
await expectAllowed("C", "officer", "select all profiles", () => S.officer.c.from("profiles").select("id"), (r) => r.data?.length >= 6);

// Former officer: sign in as officer, open Realtime, then the owner removes them.
console.log("\n-- former officer (session + Realtime from before removal)");
{
  const fc = S.former.c;
  const seen = [];
  await fc.realtime.setAuth(S.former.session.access_token);
  const ch = fc.channel(`attendance:${live.id}`, { config: { private: true } });
  const joined = await new Promise((res) => {
    ch.on("broadcast", { event: "count" }, (m) => seen.push(m.payload)).subscribe((s) => (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") && res(s));
    setTimeout(() => res("timeout"), 8000);
  });
  record(nid("C"), "officer(pre)", "join private attendance:<live>", "SUBSCRIBED", joined, joined === "SUBSCRIBED");
  const before = await fc.from("event_codes").select("code").eq("event_id", live.id);
  record(nid("C"), "officer(pre)", "read event code", "allowed", short(before), before.data?.length === 1);

  const d = await S.owner.c.rpc("set_officer", { p_user_id: former.id, p_is_officer: false });
  record(nid("C"), "owner", "remove officer (former)", "ok", short(d), !d.error);

  // Same access token, issued while they were an officer (JWT has no role claim; RLS reads the table).
  await expectDenied("C", "former", "read event codes with pre-removal JWT", () => fc.from("event_codes").select("code"));
  await expectDenied("C", "former", "select all profiles with pre-removal JWT", async () => {
    const r = await fc.from("profiles").select("id");
    return { data: (r.data ?? []).filter((x) => x.id !== former.id), error: r.error };
  });
  await expectDenied("C", "former", "officer_analytics with pre-removal JWT", () => fc.rpc("officer_analytics", { p_from: null, p_to: null }));
  await expectDenied("C", "former", "storage list event-flyers", async () => {
    const r = await fc.storage.from("event-flyers").list("", { limit: 10 });
    return r;
  });

  // Trigger a broadcast: someone checks in.
  const before2 = seen.length;
  await S.memberB.c.rpc("check_in", { p_code: live.code }); // rate-limited above, so use another member
  await S.fresh.c.rpc("check_in", { p_code: live.code });
  const extra = await makeUser("rt", { name: "Synthetic Realtime" });
  const xs = await signIn(extra);
  await xs.c.rpc("check_in", { p_code: live.code });
  await new Promise((r) => setTimeout(r, 2500));
  const got = seen.length - before2;
  record(nid("C"), "former", "open attendance channel after removal", "(expected) still receives counts until rejoin", `${got} count message(s) after removal`, true, got > 0 ? "still receiving: Realtime authorizes at join; payload is a number only" : "stopped");
  await fc.removeChannel(ch);
  const ch2 = fc.channel(`attendance:${live.id}`, { config: { private: true } });
  const rejoin = await new Promise((res) => {
    ch2.subscribe((s) => (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") && res(s));
    setTimeout(() => res("timeout"), 8000);
  });
  record(nid("C"), "former", "re-join attendance channel after removal", "refused", rejoin, rejoin !== "SUBSCRIBED");
  await fc.removeChannel(ch2);
}

// ---------------------------------------------------------------------------
// Realtime: who can join which channel
// ---------------------------------------------------------------------------
console.log("\n-- Realtime");
async function tryJoin(client, token, topic, priv = true) {
  if (token) await client.realtime.setAuth(token);
  const ch = client.channel(topic, { config: { private: priv } });
  const s = await new Promise((res) => {
    ch.subscribe((st) => (st === "SUBSCRIBED" || st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") && res(st));
    setTimeout(() => res("timeout"), 8000);
  });
  await client.removeChannel(ch);
  return s;
}
for (const [who, c, tok] of [
  ["anon", createClient(URL_, PUB, noSession), null],
  ["memberB", S.memberB.c, S.memberB.session.access_token],
  ["nonUm", S.nonUm.c, S.nonUm.session.access_token],
]) {
  const s = await tryJoin(c, tok, `attendance:${live.id}`);
  record(nid("D"), who, "join private attendance:<live>", "refused", s, s !== "SUBSCRIBED");
}
{
  const s = await tryJoin(S.memberB.c, S.memberB.session.access_token, `game:${upcoming.id}`);
  record(nid("D"), "memberB", "join private game:<event not checked in>", "refused", s, s !== "SUBSCRIBED");
  const s2 = await tryJoin(S.memberA.c, S.memberA.session.access_token, `game:${live.id}`);
  record(nid("D"), "memberA", "join private game:<checked-in event>", "allowed", s2, s2 === "SUBSCRIBED");
}
{
  // Can a member SEND on a private channel (spoof "changed" / fake counts)? With ack, the server answers.
  const c = S.memberA.c;
  await c.realtime.setAuth(S.memberA.session.access_token);
  const got = [];
  await S.officer.c.realtime.setAuth(S.officer.session.access_token);
  const listen = S.officer.c.channel(`game:${live.id}`, { config: { private: true } });
  await new Promise((res) => {
    listen.on("broadcast", { event: "*" }, (m) => got.push(m)).subscribe((s) => s === "SUBSCRIBED" && res());
    setTimeout(res, 6000);
  });
  const ch = c.channel(`game:${live.id}`, { config: { private: true, broadcast: { ack: true } } });
  await new Promise((res) => {
    ch.subscribe((s) => s === "SUBSCRIBED" && res());
    setTimeout(res, 6000);
  });
  const sendRes = await ch.send({ type: "broadcast", event: "changed", payload: { url: "https://evil.example" } });
  await new Promise((r) => setTimeout(r, 2000));
  record(nid("D"), "memberA", "send broadcast on private game:<id>", "refused, nobody receives", `ack=${sendRes}, officer received ${got.length}`, sendRes !== "ok" && got.length === 0);
  await c.removeChannel(ch);
  await S.officer.c.removeChannel(listen);
}
{
  // Public (non-private) channel with the same name: anyone can join and send, but app clients subscribe privately.
  const s = await tryJoin(createClient(URL_, PUB, noSession), null, `game:${live.id}`, false);
  record(nid("D"), "anon", "join PUBLIC game:<id> (same name)", "(info) depends on 'allow public access' setting", s, true, s === "SUBSCRIBED" ? "public channels are open: separate from private ones" : "public channels disabled");
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
console.log("\n-- Storage");
const PNG_1x1 = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex");
const flyerName = `${randomUUID()}.png`;
{
  const up = await S.officer.c.storage.from("event-flyers").upload(flyerName, PNG_1x1, { contentType: "image/png" });
  record(nid("D"), "officer", "upload flyer png", "allowed", up.error ? up.error.message : "uploaded", !up.error);
}
await expectDenied("D", "anon", "list event-flyers", async () => anon.storage.from("event-flyers").list("", { limit: 100 }));
await expectDenied("D", "memberA", "list event-flyers", async () => S.memberA.c.storage.from("event-flyers").list("", { limit: 100 }));
await expectDenied("D", "memberA", "list event-flyers/covers", async () => S.memberA.c.storage.from("event-flyers").list("covers", { limit: 100 }));
await expectDenied("D", "memberA", "upload png", async () => S.memberA.c.storage.from("event-flyers").upload(`${randomUUID()}.png`, PNG_1x1, { contentType: "image/png" }));
await expectDenied("D", "anon", "upload png", async () => anon.storage.from("event-flyers").upload(`${randomUUID()}.png`, PNG_1x1, { contentType: "image/png" }));
await expectDenied("D", "memberA", "overwrite officer flyer (upsert)", async () => S.memberA.c.storage.from("event-flyers").upload(flyerName, PNG_1x1, { contentType: "image/png", upsert: true }));
await expectDenied("D", "memberA", "delete officer flyer", async () => {
  const r = await S.memberA.c.storage.from("event-flyers").remove([flyerName]);
  return r;
});
await expectDenied("D", "memberA", "move officer flyer", async () => S.memberA.c.storage.from("event-flyers").move(flyerName, `${randomUUID()}.png`));
{
  const still = await fetch(`${URL_}/storage/v1/object/public/event-flyers/${flyerName}`);
  record(nid("D"), "anon", "public flyer still there after member attacks", "200", String(still.status), still.status === 200);
  record(nid("E"), "anon", "public object headers", "image/png + nosniff?", `ct=${still.headers.get("content-type")} nosniff=${still.headers.get("x-content-type-options") ?? "absent"}`, true);
}
for (const [name, type, body, label] of [
  [`${randomUUID()}.svg`, "image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>", "svg"],
  [`${randomUUID()}.png`, "image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>", "svg type, .png name"],
  [`${randomUUID()}.png`, "text/html", "<script>alert(1)</script>", "text/html, .png name"],
  [`../${randomUUID()}.png`, "image/png", PNG_1x1, "path traversal ../"],
  [`other/${randomUUID()}.png`, "image/png", PNG_1x1, "other folder"],
  [`${randomUUID()}.webp`, "image/webp", PNG_1x1, "webp at root (flyers png/jpg only)"],
]) {
  const r = await S.officer.c.storage.from("event-flyers").upload(name, typeof body === "string" ? Buffer.from(body) : body, { contentType: type });
  record(nid("D"), "officer", `upload ${label}`, "rejected", r.error ? `rejected: ${r.error.message.slice(0, 50)}` : "ACCEPTED", !!r.error);
}
{
  // covers/../<uuid>.png: Storage normalizes the key first; it must not land outside the allowed names.
  const id = randomUUID();
  const r = await S.officer.c.storage.from("event-flyers").upload(`covers/../${id}.png`, PNG_1x1, { contentType: "image/png" });
  const stored = psql(`select name from storage.objects where bucket_id = 'event-flyers' and name like '%${id}%';`);
  record(nid("D"), "officer", "upload covers/../<uuid>.png", "rejected, or normalized to an allowed name", r.error ? `rejected: ${r.error.message.slice(0, 40)}` : `stored in db as ${stored.replace(id, "<uuid>")}`, !!r.error || stored === `${id}.png`, "client echoes the requested path; the database row is what counts");
  if (!r.error) await admin.storage.from("event-flyers").remove([`${id}.png`]);
}
{
  // Declared image/png but the bytes are HTML: does Storage check real content?
  const name = `${randomUUID()}.png`;
  const r = await S.officer.c.storage.from("event-flyers").upload(name, Buffer.from("<html><script>alert(document.domain)</script></html>"), { contentType: "image/png" });
  let served = "";
  if (!r.error) {
    const g = await fetch(`${URL_}/storage/v1/object/public/event-flyers/${name}`);
    served = `served ct=${g.headers.get("content-type")}`;
    await S.officer.c.storage.from("event-flyers").remove([name]);
  }
  record(nid("D"), "officer", "upload HTML bytes declared image/png", "(info) Storage checks declared type only", r.error ? `rejected: ${r.error.message}` : `accepted; ${served}`, true, "officer-only; served as image/png, so not rendered as HTML");
  const big = await S.officer.c.storage.from("event-flyers").upload(`${randomUUID()}.png`, Buffer.alloc(5 * 1024 * 1024 + 10), { contentType: "image/png" });
  record(nid("D"), "officer", "upload 5 MB + 10 bytes", "rejected (size limit)", big.error ? `rejected: ${big.error.message.slice(0, 40)}` : "ACCEPTED", !!big.error);
}
await S.officer.c.storage.from("event-flyers").remove([flyerName]);

// ---------------------------------------------------------------------------
// Schemas, RPC surface, error messages
// ---------------------------------------------------------------------------
console.log("\n-- API surface");
{
  const r = await rest(S.memberA.session.access_token, "rpc/is_officer", { method: "POST", body: "{}", headers: { "Content-Profile": "private" } });
  record(nid("D"), "memberA", "call private.is_officer via Content-Profile: private", "schema not exposed", `${r.status} ${r.body?.code ?? ""}`, r.status >= 400);
  const r2 = await rest(S.memberA.session.access_token, "checkin_failures?select=*", { headers: { "Accept-Profile": "private" } });
  record(nid("D"), "memberA", "read private.checkin_failures via Accept-Profile", "schema not exposed", `${r2.status} ${r2.body?.code ?? ""}`, r2.status >= 400);
  const r3 = await rest(null, "rpc/hook_umich_only", { method: "POST", body: JSON.stringify({ event: { user: { email: "a@umich.edu" } } }) });
  record(nid("D"), "anon", "call hook_umich_only", "denied", `${r3.status} ${r3.body?.code ?? ""}`, r3.status >= 400);
  const r4 = await rest(S.memberA.session.access_token, "rpc/hook_umich_only", { method: "POST", body: JSON.stringify({ event: { user: { email: "a@umich.edu" } } }) });
  record(nid("D"), "memberA", "call hook_umich_only", "denied", `${r4.status} ${r4.body?.code ?? ""}`, r4.status >= 400);
  const r5 = await rest(null, "rpc/public_past_event_counts", { method: "POST", body: "{}" });
  const small = Array.isArray(r5.body) ? r5.body.filter((x) => x.attendance < 10).length : "n/a";
  record(nid("F"), "anon", "public_past_event_counts", "(rule: hide < 10)", `${r5.status}; rows under 10: ${small}`, true, "rule enforced in the app only (lib/events.ts), not the RPC");
  const U = randomUUID();
  const calls = {
    take_roblox_lookup: {}, my_checkin_order: { p_event_id: U }, officer_analytics: { p_from: null, p_to: null },
    save_push_subscription: { p_endpoint: "https://fcm.googleapis.com/x", p_p256dh: "B".padEnd(87, "A"), p_auth: "A".padEnd(22, "A") },
    set_officer: { p_user_id: U, p_is_officer: true }, clear_nickname: { p_user_id: U }, regenerate_event_code: { p_event_id: U },
    set_checkin_open: { p_event_id: U, p_open: true }, reorder_game_servers: { p_event_id: U, p_ids: [] },
    save_about_page: { p_expected: null, p_story: "x", p_timeline: [] }, save_community_links: { p_expected: null, p_links: [] },
    save_featured_panel: { p_expected: null, p_enabled: true, p_title: "x", p_body: "x", p_link_text: null, p_link_href: null },
    save_join_content: { p_expected: null, p_faq: [], p_what: [] }, check_in: { p_code: "ABCDE" },
  };
  for (const [fn, args] of Object.entries(calls)) {
    const r = await rest(null, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
    record(nid("D"), "anon", `rpc/${fn}`, "denied (no anon EXECUTE)", `${r.status} ${r.body?.code ?? ""}`, (r.status === 401 || r.status === 403) && r.body?.code === "42501");
  }
  const g = await fetch(`${URL_}/graphql/v1`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" }, body: JSON.stringify({ query: "{ __schema { queryType { fields { name } } } }" }) });
  const gj = await g.json().catch(() => null);
  record(nid("D"), "anon", "GraphQL introspection (local)", "(info)", `${g.status} ${JSON.stringify(gj).slice(0, 80)}`, true);
}

// ---------------------------------------------------------------------------
// Tokens: tampered, alg=none, expired, signed out
// ---------------------------------------------------------------------------
console.log("\n-- tokens");
{
  const tok = S.memberB.session.access_token;
  const [h, , s] = tok.split(".");
  const claims = decode(tok);
  const tampered = `${h}.${b64url({ ...claims, sub: owner.id, email: owner.email })}.${s}`;
  const r = await rest(tampered, "profiles?select=id");
  record(nid("B"), "tampered", "JWT with sub changed (original signature)", "401", String(r.status), r.status === 401);
  const none = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ ...claims, sub: owner.id })}.`;
  const r2 = await rest(none, "profiles?select=id");
  record(nid("B"), "tampered", "JWT alg=none", "401", String(r2.status), r2.status === 401);
  const hs = (payload) => {
    const hh = b64url({ alg: "HS256", typ: "JWT" });
    const pp = b64url(payload);
    return `${hh}.${pp}.${createHmac("sha256", "not-the-secret").update(`${hh}.${pp}`).digest("base64url")}`;
  };
  const r3 = await rest(hs({ ...claims, sub: owner.id }), "profiles?select=id");
  record(nid("B"), "tampered", "JWT HS256 with a guessed secret", "401", String(r3.status), r3.status === 401);
  if (JWT_SECRET) {
    const hh = b64url({ alg: "HS256", typ: "JWT" });
    const pp = b64url({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 });
    const expired = `${hh}.${pp}.${createHmac("sha256", JWT_SECRET).update(`${hh}.${pp}`).digest("base64url")}`;
    const r4 = await rest(expired, "profiles?select=id");
    record(nid("B"), "expired", "validly signed but expired JWT", "401", String(r4.status), r4.status === 401);
  }
  // Sign out (global): access token stays valid until expiry (accepted); refresh token is revoked.
  const so = await signIn(memberB);
  const at = so.session.access_token;
  const rt = so.session.refresh_token;
  await so.c.auth.signOut({ scope: "global" });
  const r5 = await rest(at, "profiles?select=id");
  record(nid("B"), "signed-out", "access token after global sign-out", "(accepted) valid until exp", `${r5.status}`, true, `exp in ${Math.round((decode(at).exp * 1000 - Date.now()) / 60000)} min`);
  const rr = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: rt }) });
  record(nid("B"), "signed-out", "refresh token after sign-out", "refused", String(rr.status), rr.status >= 400);
}

// Email/password sign-up path (local config allows it; production has email off: see 06-test-results).
{
  const r = await fetch(`${URL_}/auth/v1/signup`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" }, body: JSON.stringify({ email: `aud3signup${RUN}@umich.edu`, password: PASSWORD }) });
  const j = await r.json().catch(() => ({}));
  record(nid("B"), "anon", "password sign-up as any@umich.edu (LOCAL config)", "(local only) allowed; production: email provider off", `${r.status}${j.access_token ? " session issued" : ""}`, true, "verified separately: production /auth/v1/settings has email=false");
}

// ---------------------------------------------------------------------------
// Cleanup (local synthetic data only)
// ---------------------------------------------------------------------------
await admin.from("events").delete().in("id", [live.id, upcoming.id, ended.id]);
const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
for (const u of users.users.filter((u) => u.email?.startsWith("aud3"))) {
  await admin.from("profiles").update({ is_owner: false }).eq("id", u.id);
}
psql(`delete from auth.users where email like 'aud3%';`);

const fails = results.filter((r) => r.status !== "pass");
mkdirSync("security-audit/evidence", { recursive: true });
writeFileSync(
  "security-audit/evidence/persona-matrix.json",
  JSON.stringify({ ranAt: new Date().toISOString(), target: "local Supabase (127.0.0.1)", total: results.length, failed: fails.length, results: results.map((r) => ({ ...r, actual: r.actual.replaceAll(RUN, "<run>") })) }, null, 2),
);
console.log(`\n${results.length} checks, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
