#!/usr/bin/env node
// Security audit 3, section J: can the officer backup (backup.zip) actually bring
// the club's data back? A restore drill on the LOCAL stack with synthetic data:
//
//   1. Make synthetic members, events, check-ins and RSVPs (aud3r…@umich.edu).
//   2. Download /officer/backup.zip as an officer through the real route.
//   3. "Disaster": delete those users and events.
//   4. Restore from the CSVs only, the way an owner would have to.
//   5. Compare with a snapshot taken before step 3, field by field.
//
//   node security-audit/attacks/restore-drill.mjs      (needs the .next-e2e build)

import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { isLocalUrl } from "../../src/lib/e2e.ts";

const st = JSON.parse((() => { const r = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" }); return r.stdout.slice(r.stdout.indexOf("{")); })());
if (!isLocalUrl(st.API_URL) || !isLocalUrl(st.DB_URL.replace(/^postgres(ql)?:/, "http:"))) { console.error("Refusing: Supabase is not local."); process.exit(1); }
if (!existsSync(".next-e2e/BUILD_ID")) { console.error("Build first: npm run test:e2e"); process.exit(1); }

const PORT = 3205, BASE = `http://localhost:${PORT}`;
const PASSWORD = randomBytes(18).toString("base64url");
const RUN = randomUUID().slice(0, 6);
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: st.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: st.PUBLISHABLE_KEY, NEXT_PUBLIC_SITE_URL: BASE, E2E_TEST_AUTH: "1", E2E_TEST_PASSWORD: PASSWORD, NEXT_TELEMETRY_DISABLED: "1" };
delete env.VERCEL;
const server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, stdio: "ignore" });
process.on("exit", () => { try { server.kill("SIGTERM"); } catch {} });
for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const admin = createClient(st.API_URL, st.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const out = { ranAt: new Date().toISOString(), checks: [], notRestorable: [] };
const check = (name, pass, detail) => { out.checks.push({ name, pass, detail }); console.log(`${pass ? "pass" : "FAIL"}  ${name}: ${detail}`); };

// 1. Synthetic data -----------------------------------------------------------
async function makeUser(tag, extra = {}) {
  const email = `aud3r${tag}${RUN}@umich.edu`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Synthetic ${tag}` } });
  if (error) throw error;
  await admin.from("profiles").update({ onboarded_at: new Date().toISOString(), ...extra }).eq("id", data.user.id);
  return { id: data.user.id, email };
}
const officer = await makeUser("off", { is_officer: true, nickname: "Officer Olive" });
const members = [
  await makeUser("m1", { nickname: "Mia", roblox_username: "aud3_mia", roblox_user_id: 111 }),
  await makeUser("m2", { nickname: "-dash first" }), // starts with "-": the CSV export prefixes it with '
  await makeUser("m3"),
];
const hour = 3600e3;
const { data: evs, error: evErr } = await admin.from("events").insert([
  { title: `AUD3R past ${RUN}`, location: "CCCB 1420", description: "- bring a laptop\n=not a formula", starts_at: new Date(Date.now() - 50 * hour).toISOString(), ends_at: new Date(Date.now() - 48 * hour).toISOString(), capacity: 30 },
  { title: `AUD3R next ${RUN}`, location: "Duderstadt", description: "Plain", starts_at: new Date(Date.now() + 48 * hour).toISOString(), ends_at: new Date(Date.now() + 50 * hour).toISOString() },
]).select("id");
if (evErr) throw evErr;
const [past, next] = evs.map((e) => e.id);
for (const [i, m] of members.entries()) {
  await admin.from("attendance").insert({ event_id: past, user_id: m.id, checked_in_at: new Date(Date.now() - 49 * hour + i * 60e3).toISOString() });
  await admin.from("event_rsvps").insert({ event_id: next, user_id: m.id });
}
await admin.from("event_rsvps").insert({ event_id: past, user_id: members[0].id });
const ids = [officer.id, ...members.map((m) => m.id)];

async function snapshot() {
  const { data: p } = await admin.from("profiles").select("uniqname, full_name, nickname, roblox_username, roblox_user_id, is_officer, is_owner").like("uniqname", `aud3r%${RUN}`).order("uniqname");
  const { data: e } = await admin.from("events").select("id, title, description, location, category, starts_at, ends_at, capacity").like("title", `AUD3R % ${RUN}`).order("title");
  const eventIds = (e ?? []).map((x) => x.id);
  const { data: a } = await admin.from("attendance").select("event_id, checked_in_at, profiles(uniqname)").in("event_id", eventIds);
  const { data: r } = await admin.from("event_rsvps").select("event_id, profiles(uniqname)").in("event_id", eventIds);
  const norm = (rows, f) => (rows ?? []).map(f).sort();
  return {
    profiles: p,
    events: e,
    attendance: norm(a, (x) => `${x.event_id}|${x.profiles.uniqname}|${new Date(x.checked_in_at).toISOString()}`),
    rsvps: norm(r, (x) => `${x.event_id}|${x.profiles.uniqname}`),
  };
}
const before = await snapshot();

// 2. Backup through the real route -------------------------------------------
const signIn = await fetch(`${BASE}/auth/test-sign-in?email=${encodeURIComponent(officer.email)}&next=/`, { redirect: "manual" });
const cookie = signIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const res = await fetch(`${BASE}/officer/backup.zip`, { headers: { cookie } });
check("officer downloads backup.zip", res.status === 200, `HTTP ${res.status}, ${res.headers.get("cache-control")}`);
const dir = mkdtempSync(join(process.env.AUD3_TMP ?? tmpdir(), "aud3-restore-"));
writeFileSync(join(dir, "backup.zip"), Buffer.from(await res.arrayBuffer()));
const unzip = spawnSync("unzip", ["-o", "-q", join(dir, "backup.zip"), "-d", join(dir, "x")]);
check("zip opens with a standard tool", unzip.status === 0, `unzip exit ${unzip.status}`);

function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\r" && text[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += c;
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const csv = (f) => parseCsv(readFileSync(join(dir, "x", f), "utf8"));
// Undo the export's formula guard: it adds ' before a leading = + - @ tab or CR.
const unguard = (s) => (s && /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);
const empty = (s) => (s === "" ? null : s);
const files = { members: csv("members.csv"), events: csv("events.csv"), attendance: csv("attendance.csv"), rsvps: csv("rsvps.csv") };
const mine = {
  members: files.members.filter((m) => m.uniqname.startsWith("aud3r") && m.uniqname.endsWith(RUN)),
  events: files.events.filter((e) => e.id === past || e.id === next),
};
mine.attendance = files.attendance.filter((a) => a.event_id === past || a.event_id === next);
mine.rsvps = files.rsvps.filter((r) => r.event_id === past || r.event_id === next);
check("backup has every synthetic row", mine.members.length === 4 && mine.events.length === 2 && mine.attendance.length === 3 && mine.rsvps.length === 4, `members ${mine.members.length}/4, events ${mine.events.length}/2, check-ins ${mine.attendance.length}/3, RSVPs ${mine.rsvps.length}/4`);
check("formula guard applied to values starting with - or =", mine.members.some((m) => m.nickname === "'-dash first") && mine.events.some((e) => e.description.startsWith("'- bring")), "nickname and description exported with a leading '");

// 3. Disaster -----------------------------------------------------------------
await admin.from("events").delete().in("id", [past, next]);
for (const id of ids) await admin.auth.admin.deleteUser(id);
const gone = await snapshot();
check("disaster removed everything", gone.profiles.length === 0 && gone.events.length === 0, `profiles ${gone.profiles.length}, events ${gone.events.length}`);

// 4. Restore from the CSVs only -------------------------------------------------
// Accounts: auth users can't be restored from the backup (no auth data in it).
// The owner has to recreate them by email; they get NEW ids, so everything is
// re-linked by uniqname. (In production, members would sign in with Google again.)
const idFor = {};
for (const m of mine.members) {
  const { data, error } = await admin.auth.admin.createUser({ email: m.email, email_confirm: true, user_metadata: { full_name: m.name } });
  if (error) throw error;
  idFor[m.uniqname] = data.user.id;
  await admin.from("profiles").update({
    nickname: empty(unguard(m.nickname)), roblox_username: empty(unguard(m.roblox_username)), roblox_user_id: m.roblox_user_id ? Number(m.roblox_user_id) : null,
    is_officer: m.officer === "yes", is_owner: m.owner === "yes", onboarded_at: new Date().toISOString(),
  }).eq("id", data.user.id);
}
check("restored accounts get new ids (old ids in the backup are useless)", mine.members.every((m) => idFor[m.uniqname] !== m.id), "all 4 differ");
const { error: evRestoreErr } = await admin.from("events").insert(mine.events.map((e) => ({
  id: e.id, title: unguard(e.title), description: empty(unguard(e.description)), location: empty(unguard(e.location)), category: e.category, starts_at: e.starts_at, ends_at: e.ends_at, capacity: e.capacity ? Number(e.capacity) : null,
})));
check("events re-inserted with their original ids", !evRestoreErr, evRestoreErr?.message ?? "ok");
const { error: aErr } = await admin.from("attendance").insert(mine.attendance.map((a) => ({ event_id: a.event_id, user_id: idFor[a.uniqname], checked_in_at: a.checked_in_at })));
const { error: rErr } = await admin.from("event_rsvps").insert(mine.rsvps.map((r) => ({ event_id: r.event_id, user_id: idFor[r.uniqname], created_at: r.rsvped_at })));
check("check-ins and RSVPs re-linked by uniqname", !aErr && !rErr, aErr?.message ?? rErr?.message ?? "ok");

// 5. Compare ------------------------------------------------------------------
const after = await snapshot();
const same = (k) => JSON.stringify(before[k]) === JSON.stringify(after[k]);
for (const k of ["profiles", "events", "attendance", "rsvps"]) check(`restored ${k} match the snapshot`, same(k), same(k) ? `${before[k].length} rows identical` : `before ${JSON.stringify(before[k]).slice(0, 200)} … after ${JSON.stringify(after[k]).slice(0, 200)}`);

out.notRestorable = [
  "auth accounts (Google identities): not in the backup; members sign in again, then data must be matched by uniqname",
  "event check-in codes (event_codes): regenerated automatically for re-inserted events",
  "game server links, announcements, Links/Join/Featured/About content, site_content_edits",
  "push devices (members turn notifications on again), event_reminders_sent",
  "flyer and cover images: only their paths are in events.csv; the files live in Storage and aren't in the zip",
  "rows created inside private.* (wrong-code times, Roblox lookups): not needed",
];
console.log("\nNot in the backup:\n- " + out.notRestorable.join("\n- "));

// Cleanup ---------------------------------------------------------------------
await admin.from("events").delete().in("id", [past, next]);
for (const id of Object.values(idFor)) await admin.auth.admin.deleteUser(id);
mkdirSync("security-audit/evidence", { recursive: true });
writeFileSync("security-audit/evidence/restore-drill.json", JSON.stringify(out, null, 2));
process.exit(out.checks.every((c) => c.pass) ? 0 : 1);
