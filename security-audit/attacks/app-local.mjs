#!/usr/bin/env node
// Security audit 3: attacks on the Next.js app (server actions, route handlers,
// caching headers, payloads, redirects, image optimizer), against the LOCAL E2E
// build (.next-e2e, made by `npm run test:e2e`) and the LOCAL Supabase only.
//
//   node security-audit/attacks/app-local.mjs
//
// Starts `next start -p 3201` itself with the same kind of env as scripts/e2e.mjs.
// Synthetic users/events only; prints no keys, tokens or cookies.

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { isLocalUrl } from "../../src/lib/e2e.ts";

const st = JSON.parse((() => { const r = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" }); return r.stdout.slice(r.stdout.indexOf("{")); })());
if (!isLocalUrl(st.API_URL)) { console.error("Refusing: Supabase is not local."); process.exit(1); }
if (!existsSync(".next-e2e/BUILD_ID")) { console.error("Build first: npm run test:e2e"); process.exit(1); }

const PORT = 3201;
const BASE = `http://localhost:${PORT}`;
const PASSWORD = randomBytes(18).toString("base64url");
const RUN = randomUUID().slice(0, 6);
const vapid = JSON.parse(readFileSync(".next-e2e/e2e-vapid.json", "utf8"));
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: st.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: st.PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: BASE,
  E2E_TEST_AUTH: "1",
  E2E_TEST_PASSWORD: PASSWORD,
  E2E_ROBLOX_API: "http://127.0.0.1:3299",
  E2E_PUSH_SERVICE: "http://127.0.0.1:3298",
  SUPABASE_SECRET_KEY: st.SECRET_KEY ?? st.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  CRON_SECRET: randomBytes(18).toString("base64url"),
  NEXT_TELEMETRY_DISABLED: "1",
};
delete env.VERCEL;

const admin = createClient(st.API_URL, st.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const results = [];
let n = 0;
function record(area, persona, operation, expected, actual, pass, note = "") {
  const id = `${area}-${String(++n).padStart(2, "0")}`;
  results.push({ id, persona, operation, expected, actual, status: pass ? "pass" : "FAIL", note });
  console.log(`${pass ? "pass" : "FAIL"} ${id.padEnd(6)} ${persona.padEnd(9)} ${operation} → ${actual}${note ? `  (${note})` : ""}`);
}

const server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
const stop = () => { try { server.kill("SIGTERM"); } catch {} };
process.on("exit", stop);
for (let i = 0; i < 120; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

// ---------------------------------------------------------------------------
// Users, sessions (cookie jars from /auth/test-sign-in), data
// ---------------------------------------------------------------------------
async function makeUser(tag, { officer = false, owner = false, onboarded = true, nickname = null } = {}) {
  const email = `aud3${tag}${RUN}@umich.edu`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Synthetic ${tag}` } });
  if (error) throw error;
  await admin.from("profiles").update({ is_officer: officer || owner, is_owner: owner, onboarded_at: onboarded ? new Date().toISOString() : null, nickname }).eq("id", data.user.id);
  return { id: data.user.id, email, uniqname: `aud3${tag}${RUN}` };
}
async function jarFor(user) {
  const res = await fetch(`${BASE}/auth/test-sign-in?email=${encodeURIComponent(user.email)}&next=/`, { redirect: "manual" });
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]);
  const flags = res.headers.getSetCookie().map((c) => c.split(";").slice(1).map((s) => s.trim().split("=")[0].toLowerCase()).sort().join(","));
  return { cookie: cookies.join("; "), flags };
}
const get = (path, jar, headers = {}) => fetch(`${BASE}${path}`, { redirect: "manual", headers: { ...(jar ? { cookie: jar.cookie } : {}), ...headers } });

const owner = await makeUser("own", { owner: true });
const officer = await makeUser("off", { officer: true });
const member = await makeUser("mem", { nickname: "Synthetic Mia" });
const other = await makeUser("oth", { nickname: "Secret Sam" });
const J = { owner: await jarFor(owner), officer: await jarFor(officer), member: await jarFor(member), other: await jarFor(other) };
record("B", "member", "auth cookie flags (local http build)", "HttpOnly? SameSite=Lax, Path=/", [...new Set(J.member.flags)].join(" | "), J.member.flags.every((f) => f.includes("samesite") && f.includes("path")), "Secure is off on http://localhost by design (cookie-options.ts)");

const { data: ev } = await admin.from("events").insert({
  title: `AUD3 <script>alert(1)</script> "><img src=x onerror=alert(2)> ${RUN}`,
  location: `CCCB 1420 <b>x</b> javascript:alert(3)`,
  description: `<iframe src="https://evil.example"></iframe>\n[click](javascript:alert(4))`,
  starts_at: new Date(Date.now() - 30 * 60e3).toISOString(),
  ends_at: new Date(Date.now() + 90 * 60e3).toISOString(),
  checkin_open: true,
}).select("id").single();
const { data: codeRow } = await admin.from("event_codes").select("code").eq("event_id", ev.id).single();
await admin.from("event_game_servers").insert({ event_id: ev.id, url: `https://www.roblox.com/share?code=aud3secret${RUN}`, label: "Server <b>1</b>" });
// The other member is checked in (their name must never reach the member).
await createClient(st.API_URL, st.PUBLISHABLE_KEY, { auth: { persistSession: false } }).auth.signInWithPassword({ email: other.email, password: PASSWORD }).then(async ({ data }) => {
  const c = createClient(st.API_URL, st.PUBLISHABLE_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
  await c.rpc("check_in", { p_code: codeRow.code });
});

// ---------------------------------------------------------------------------
// E. Caching headers on private pages and exports
// ---------------------------------------------------------------------------
console.log("\n-- caching");
for (const [path, who] of [["/officer/members", "officer"], ["/officer", "officer"], [`/officer/events/${ev.id}`, "officer"], ["/profile", "member"], ["/checkin", "member"], ["/play", "member"], ["/officer/members.csv", "officer"], ["/officer/backup.zip", "officer"], [`/officer/events/${ev.id}/attendance.csv`, "officer"]]) {
  const res = await get(path, J[who]);
  const cc = res.headers.get("cache-control") ?? "(none)";
  const body = await res.text();
  const hasPII = body.includes(other.uniqname) || body.includes("Secret Sam") || body.includes(member.uniqname);
  const ok = /no-store/.test(cc) || !hasPII;
  record("E", who, `GET ${path.replace(ev.id, "<id>")} Cache-Control`, "no-store when the body has personal data", `${res.status} cc="${cc}" personal-data=${hasPII}`, ok);
}

// ---------------------------------------------------------------------------
// E. Payloads: nothing private reaches the wrong persona (HTML + RSC)
// ---------------------------------------------------------------------------
console.log("\n-- payloads");
for (const [path, who, rsc] of [["/", "member", false], [`/events/${ev.id}`, "member", false], [`/events/${ev.id}`, "anon", false], [`/events/${ev.id}`, "member", true], ["/play", "member", false], ["/checkin", "member", false], ["/officer", "member", false], ["/officer/members", "member", false], [`/officer/events/${ev.id}`, "member", false], ["/profile", "member", false]]) {
  const res = await get(path, who === "anon" ? null : J[who], rsc ? { RSC: "1" } : {});
  const body = await res.text();
  const leaks = [
    body.includes(other.uniqname) && "other member's uniqname",
    body.includes("Secret Sam") && "other member's nickname",
    body.includes(codeRow.code) && "event code",
    body.includes(`aud3secret${RUN}`) && "game server URL",
    body.includes(officer.uniqname) && "officer uniqname",
    /"is_officer":true/.test(body) && "is_officer flag",
  ].filter(Boolean);
  record("E", who, `${rsc ? "RSC " : ""}GET ${path.replace(ev.id, "<id>")} leaks`, "none", leaks.length ? leaks.join(", ") : `none (${res.status})`, leaks.length === 0);
}
{
  // XSS payloads in event fields must arrive escaped.
  const html = await (await get(`/events/${ev.id}`, null)).text();
  const raw = ["<script>alert(1)</script>", "<img src=x onerror=alert(2)>", "<iframe src=\"https://evil.example\">", "<b>x</b>", "href=\"javascript:"].filter((p) => html.includes(p));
  record("E", "anon", "event page renders stored XSS payloads escaped", "no raw tags/javascript: hrefs", raw.length ? `RAW: ${raw.join(" ")}` : "escaped", raw.length === 0);
  const meta = /<meta property="og:title" content="([^"]*)"/.exec(html)?.[1] ?? "";
  record("E", "anon", "og:title escaping", "entity-encoded", meta.includes("<") ? "RAW <" : "encoded", !meta.includes("<"));
  const ics = await (await get(`/events/${ev.id}/calendar.ics`, null)).text();
  record("E", "anon", ".ics has no injected lines", "one SUMMARY, no extra BEGIN", `${(ics.match(/^SUMMARY/mg) ?? []).length} SUMMARY, ${(ics.match(/^BEGIN:VEVENT/mg) ?? []).length} VEVENT`, (ics.match(/^BEGIN:VEVENT/mg) ?? []).length === 1);
}

// ---------------------------------------------------------------------------
// C/E. Server actions called directly (Next-Action), as the wrong persona
// ---------------------------------------------------------------------------
console.log("\n-- server actions");
const manifest = JSON.parse(readFileSync(".next-e2e/server/server-reference-manifest.json", "utf8")).node;
const actionId = (name) => Object.entries(manifest).find(([, v]) => v.exportedName === name)?.[0];
async function callAction(name, args, jar, { page = "/", origin = BASE, id } = {}) {
  const res = await fetch(`${BASE}${page}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Next-Action": id ?? actionId(name),
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
      ...(origin ? { Origin: origin } : {}),
      ...(jar ? { cookie: jar.cookie } : {}),
    },
    body: JSON.stringify(args),
  });
  return { status: res.status, body: (await res.text()).slice(0, 400) };
}
const officerPage = `/officer/events/${ev.id}`;
async function profileRow(id) {
  return (await admin.from("profiles").select("is_officer, nickname").eq("id", id).single()).data;
}
{
  const r = await callAction("setOfficer", [member.id, true], J.member, { page: "/officer/members" });
  record("C", "member", "server action setOfficer(self, true)", "refused, no change", `${r.status}; is_officer=${(await profileRow(member.id)).is_officer}`, (await profileRow(member.id)).is_officer === false);
  const r2 = await callAction("setOfficer", [member.id, true], J.officer, { page: "/officer/members" });
  record("C", "officer", "server action setOfficer(member, true)", "refused (owners only)", `${r2.status} ${/Only owners/.test(r2.body) ? "'Only owners…'" : ""}; is_officer=${(await profileRow(member.id)).is_officer}`, (await profileRow(member.id)).is_officer === false);
  const r3 = await callAction("setOfficer", [owner.id, false], J.officer, { page: "/officer/members" });
  record("C", "officer", "server action setOfficer(owner, false)", "refused", `${r3.status}; owner is_officer=${(await profileRow(owner.id)).is_officer}`, (await profileRow(owner.id)).is_officer === true);
  const r4 = await callAction("clearNickname", [other.id], J.member, { page: "/officer/members" });
  record("C", "member", "server action clearNickname(other)", "refused, no change", `${r4.status}; nickname=${(await profileRow(other.id)).nickname}`, (await profileRow(other.id)).nickname === "Secret Sam");
  const before = (await admin.from("attendance").select("user_id").eq("event_id", ev.id)).data.length;
  await callAction("removeAttendance", [ev.id, other.id], J.member, { page: officerPage });
  const after = (await admin.from("attendance").select("user_id").eq("event_id", ev.id)).data.length;
  record("C", "member", "server action removeAttendance(other)", "refused, no change", `attendance ${before}→${after}`, after === before);
  await callAction("deleteEvent", [ev.id], J.member, { page: officerPage });
  const still = (await admin.from("events").select("id").eq("id", ev.id)).data.length;
  record("C", "member", "server action deleteEvent", "refused", still ? "event still there" : "DELETED", still === 1);
  await callAction("regenerateCode", [ev.id], J.member, { page: officerPage });
  const code2 = (await admin.from("event_codes").select("code").eq("event_id", ev.id).single()).data.code;
  record("C", "member", "server action regenerateCode", "refused", code2 === codeRow.code ? "unchanged" : "CHANGED", code2 === codeRow.code);
  await callAction("addGameServer", [ev.id, "https://www.roblox.com/share?code=aud3member", "Mine"], J.member, { page: officerPage });
  const servers = (await admin.from("event_game_servers").select("id").eq("event_id", ev.id)).data.length;
  record("C", "member", "server action addGameServer", "refused", `${servers} server(s)`, servers === 1);
  const fd = new FormData();
  fd.set("message", "AUD3 pwned");
  const r5 = await fetch(`${BASE}/officer/announcement`, { method: "POST", redirect: "manual", headers: { "Next-Action": actionId("saveAnnouncement"), Origin: BASE, cookie: J.member.cookie, Accept: "text/x-component" }, body: (() => { const f = new FormData(); f.set("1_message", "AUD3 pwned"); f.set("0", JSON.stringify(["$K1", "$K1"])); return f; })() });
  const ann = (await admin.from("announcements").select("message")).data ?? [];
  record("C", "member", "server action saveAnnouncement", "refused", `${r5.status}; ${ann.some((a) => a.message === "AUD3 pwned") ? "PUBLISHED" : "not published"}`, !ann.some((a) => a.message === "AUD3 pwned"));
  const r6 = await callAction("saveLinks", [{}, null], J.member, { page: "/officer/content" });
  record("C", "member", "server action saveLinks", "refused", `${r6.status}`, r6.status >= 400 || !/version/.test(r6.body));
  const r7 = await callAction("setOfficer", [member.id, true], null, { page: "/officer/members" });
  record("C", "anon", "server action setOfficer (signed out)", "refused", `${r7.status}; is_officer=${(await profileRow(member.id)).is_officer}`, (await profileRow(member.id)).is_officer === false);
}
{
  // CSRF: a signed-in member's browser posting from another site.
  const r = await callAction("saveProfile", [{}, null], J.member, { page: "/profile", origin: "https://evil.example" });
  record("E", "member", "server action with Origin: https://evil.example", "refused (Next origin check)", `${r.status}`, r.status >= 400 && r.status !== 404 ? true : r.status >= 400);
  const r2 = await callAction("turnOffNotifications", ["https://fcm.googleapis.com/x"], J.member, { page: "/profile", origin: "null" });
  record("E", "member", "server action with Origin: null (sandboxed iframe)", "refused", `${r2.status}`, r2.status >= 400);
  const r3 = await callAction("turnOffNotifications", ["https://fcm.googleapis.com/x"], J.member, { page: "/profile", origin: null });
  record("E", "member", "server action with no Origin header", "(info) Next allows; browsers always send Origin on POST", `${r3.status}`, true);
  // "use cache" functions are in the manifest: they must not be callable as actions.
  for (const [id, v] of Object.entries(manifest).filter(([, v]) => v.exportedName?.startsWith("$$RSC_SERVER_CACHE")).slice(0, 20)) {
    const rr = await callAction(null, [], null, { page: "/", id });
    record("E", "anon", `invoke ${v.exportedName} (${v.filename.split("/").pop()}) as an action`, "refused (404 from proxy.ts, L-8 fix)", `${rr.status} ${rr.body.slice(0, 50).replace(/\s+/g, " ")}`, rr.status >= 400);
  }
  const rb = await callAction(null, [], null, { page: "/", id: "00" + randomBytes(20).toString("hex") });
  record("E", "anon", "unknown action id", "404/400, no stack", `${rb.status} stack=${/at .*\(.*\.js/.test(rb.body)}`, rb.status >= 400 && !/at .*\(.*\.js/.test(rb.body));
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
console.log("\n-- route handlers");
for (const [path, who, expect] of [["/officer/members.csv", "member", 403], ["/officer/members.csv", null, 403], ["/officer/backup.zip", "member", 403], [`/officer/events/${ev.id}/attendance.csv`, "member", 403], ["/officer/members.csv", "officer", 200], ["/api/cron/reminders", "officer", 401], ["/api/keep-alive", null, 401]]) {
  const res = await get(path, who ? J[who] : null);
  record("C", who ?? "anon", `GET ${path.replace(ev.id, "<id>")}`, String(expect), String(res.status), res.status === expect);
}
{
  const bad = await get("/api/cron/reminders", null, { Authorization: "Bearer wrong" });
  const bad2 = await get("/api/cron/reminders", null, { Authorization: `Bearer ${env.CRON_SECRET}x` });
  const good = await get("/api/cron/reminders", null, { Authorization: `Bearer ${env.CRON_SECRET}` });
  const good2 = await get("/api/cron/reminders", null, { Authorization: `Bearer ${env.CRON_SECRET}` });
  record("F", "cron", "reminders: wrong / longer secret", "401, 401", `${bad.status}, ${bad2.status}`, bad.status === 401 && bad2.status === 401);
  const j1 = await good.json(), j2 = await good2.json();
  record("F", "cron", "reminders twice in a row", "second run sends nothing new", `run1 events=${j1.events} run2 events=${j2.events}`, j2.events === 0);
  for (const [origin, ct] of [["https://evil.example", "application/json"], [BASE, "text/plain"], [null, "application/json"]]) {
    const r = await fetch(`${BASE}/api/push/subscription`, { method: "POST", headers: { cookie: J.member.cookie, "Content-Type": ct, ...(origin ? { Origin: origin } : {}) }, body: "{}" });
    record("E", "member", `POST /api/push/subscription origin=${origin ?? "none"} ct=${ct}`, "403", String(r.status), r.status === 403);
  }
  const so = await fetch(`${BASE}/auth/signout`, { method: "POST", redirect: "manual", headers: { Origin: "https://evil.example", cookie: J.other.cookie } });
  const stillIn = await get("/profile", J.other);
  record("E", "other", "POST /auth/signout from another origin (cookies attached)", "403, still signed in (I-3 fix)", `${so.status}; afterwards /profile ${stillIn.status}`, so.status === 403 && stillIn.status === 200);
}

// ---------------------------------------------------------------------------
// Redirects, host header
// ---------------------------------------------------------------------------
console.log("\n-- redirects");
for (const next of ["//evil.example", "/\\evil.example", "/..//evil.example", "https://evil.example", "/%2F%2Fevil.example", "/%5Cevil.example", "javascript:alert(1)", "/\t/evil.example", "/ /evil.example"]) {
  const res = await get(`/auth/callback?error=access_denied&next=${encodeURIComponent(next)}`, null);
  const loc = res.headers.get("location") ?? "";
  const target = new URL(loc, BASE);
  const nextParam = target.searchParams.get("next") ?? "";
  const nextHost = new URL(nextParam || "/", BASE).host;
  record("E", "anon", `callback next=${JSON.stringify(next)}`, "stays on site", `next=${nextParam}`, target.host === new URL(BASE).host && nextHost === new URL(BASE).host);
  const lp = await (await get(`/login?next=${encodeURIComponent(next)}`, J.member)).text();
  const m = /NEXT_REDIRECT;[a-z]+;([^;]+);/.exec(lp);
  const dest = m ? m[1] : "(no redirect)"; // as the browser receives it (still percent-encoded)
  record("E", "member", `login (signed in) next=${JSON.stringify(next)}`, "same-site redirect", dest, !m || new URL(dest, BASE).host === new URL(BASE).host);
}
for (const p of ["/go/gameover", "/go/%2e%2e", "/go/..%2f..%2fevil.example", "/go//evil.example", "/go/GAMEOVER", "/go/x/y"]) {
  const res = await get(p, null);
  const loc = res.headers.get("location") ?? "";
  const home = res.status === 200 && (await res.text()).includes("<title>Roblox at UM</title>"); // "/go/.." normalizes to "/"
  record("E", "anon", `GET ${p}`, "307 same-site (or the home page)", `${res.status} ${home ? "home page" : loc.replace(BASE, "")}`, res.status >= 300 && res.status < 400 ? new URL(loc, BASE).host === new URL(BASE).host : home || res.status === 404);
}
{
  const res = await get("/auth/callback?error=x", null, { Host: "evil.example" });
  record("H", "anon", "callback with Host: evil.example", "(info) absolute Location from Host", `${res.status} ${res.headers.get("location")?.slice(0, 50)}`, true, "Vercel only routes assigned domains; self-hosting would need a fixed host");
  const res2 = await get("/go/gameover", null, { "X-Forwarded-Host": "evil.example" });
  record("H", "anon", "/go with X-Forwarded-Host: evil.example", "(info)", `${res2.headers.get("location")?.slice(0, 50)}`, true);
}

// ---------------------------------------------------------------------------
// Image optimizer (resource abuse)
// ---------------------------------------------------------------------------
console.log("\n-- image optimizer");
for (const [label, url] of [
  // M-1 fixed: no Roblox host is an allowed remote pattern any more.
  ["rbxcdn avatar host", "https://tr.rbxcdn.com/does-not-matter.png"],
  ["arbitrary rbxcdn subdomain", "https://anything.rbxcdn.com/x.png"],
  ["supabase storage other bucket", `${st.API_URL}/storage/v1/object/public/other/x.png`],
  ["evil host", "https://evil.example/x.png"],
]) {
  const res = await get(`/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`, null);
  record("F", "anon", `/_next/image ${label}`, "400 (not allowed)", `${res.status}`, res.status === 400);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
await admin.from("events").delete().eq("id", ev.id);
await admin.from("announcements").delete().eq("message", "AUD3 pwned");
execFileSync("docker", ["exec", "-i", "supabase_db_website", "psql", "-U", "postgres", "-c", "delete from auth.users where email like 'aud3%';"]);
stop();
const errs = serverLog.split("\n").filter((l) => /error|unhandled/i.test(l)).slice(0, 15);
mkdirSync("security-audit/evidence", { recursive: true });
writeFileSync("security-audit/evidence/app-local.json", JSON.stringify({ ranAt: new Date().toISOString(), target: "local E2E build + local Supabase", total: results.length, failed: results.filter((r) => r.status !== "pass").length, results: results.map((r) => ({ ...r, actual: r.actual.replaceAll(RUN, "<run>") })), serverErrorLines: errs.map((l) => l.replaceAll(RUN, "<run>").slice(0, 200)) }, null, 2));
console.log(`\n${results.length} checks, ${results.filter((r) => r.status !== "pass").length} failed`);
process.exit(0);
