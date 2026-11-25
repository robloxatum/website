#!/usr/bin/env node
// End-to-end tests: npm run test:e2e [-- <playwright args>]
//
//   1. Local Supabase only (Docker, via the Supabase CLI). Refuses to run if the
//      database or API isn't on this machine, so the tests can never touch the
//      production project.
//   2. Resets the local database (real migrations + RLS) for a clean run.
//   3. Builds an E2E production build into .next-e2e (with the test sign-in route).
//   4. Runs Playwright against `next start` on http://localhost:3200.
//   5. Builds a NORMAL production build and proves it has no test sign-in route.
//
// Push notifications use throwaway VAPID keys made for the build (kept next to
// it, since the public key is built in) and a local mock push service.
//
// Flags: --no-reset (keep the data), --no-build (reuse .next-e2e),
//        --no-prod-check (skip step 5). Anything else goes to Playwright.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateVAPIDKeys } from "web-push";
import { isLocalUrl } from "../src/lib/e2e.ts";

const args = process.argv.slice(2);
const flag = (f) => {
  const i = args.indexOf(f);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};
const noReset = flag("--no-reset");
const noBuild = flag("--no-build");
const noProdCheck = flag("--no-prod-check");

const EXCLUDE = "studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta";

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    console.error(`\n✖ ${cmd} ${cmdArgs.join(" ")} failed (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
  return r;
}

function localStatus() {
  const r = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  } catch {
    return null;
  }
}

let status = localStatus();
if (!status?.API_URL) {
  console.log("Starting local Supabase (Docker)…");
  run("npx", ["supabase", "start", "-x", EXCLUDE]);
  status = localStatus();
}
if (!status?.API_URL) {
  console.error("✖ Couldn't read local Supabase status. Is Docker running? (colima start)");
  process.exit(1);
}

const apiUrl = status.API_URL;
const dbUrl = status.DB_URL;
// The one rule that matters: never anything but this machine.
if (!isLocalUrl(apiUrl) || !isLocalUrl(dbUrl.replace(/^postgres(ql)?:/, "http:"))) {
  console.error(`✖ Refusing to run: Supabase isn't local (API ${apiUrl}).`);
  process.exit(1);
}

if (!noReset) {
  console.log("Resetting the local test database…");
  // --local: the Docker database, never a linked project.
  run("npx", ["supabase", "db", "reset", "--local", "--no-seed"]);
}

// The VAPID public key is compiled into the build, so a reused build keeps its keys.
const VAPID_FILE = ".next-e2e/e2e-vapid.json";
const rebuild = !noBuild || !existsSync(".next-e2e/BUILD_ID") || !existsSync(VAPID_FILE);
const vapid = rebuild ? generateVAPIDKeys() : JSON.parse(readFileSync(VAPID_FILE, "utf8"));

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  NEXT_PUBLIC_SITE_URL: "http://localhost:3200",
  E2E_TEST_AUTH: "1",
  // Fresh each run: the password every seeded test user signs in with.
  E2E_TEST_PASSWORD: process.env.E2E_TEST_PASSWORD ?? randomBytes(18).toString("base64url"),
  E2E_ROBLOX_API: "http://127.0.0.1:3299",
  // For the tests only (seeding); the app never reads it.
  E2E_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  E2E_DB_URL: dbUrl,
  // Push notifications: the app reads these (the secret key only in lib/push/send.ts).
  SUPABASE_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: "mailto:push-e2e@example.invalid",
  CRON_SECRET: randomBytes(18).toString("base64url"),
  NEXT_TELEMETRY_DISABLED: "1",
};
delete env.VERCEL;

if (rebuild) {
  console.log("Building the E2E production build (.next-e2e)…");
  run("npx", ["next", "build"], { env });
  writeFileSync(VAPID_FILE, JSON.stringify(vapid));
}

const pw = spawnSync("npx", ["playwright", "test", ...args], { stdio: "inherit", env });

let prodOk = true;
if (!noProdCheck && args.length === 0) {
  console.log("\nChecking that a normal production build has no test sign-in…");
  const r = spawnSync("node", ["e2e/prod-build.check.mjs"], { stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } });
  prodOk = r.status === 0;
}

process.exit(pw.status === 0 && prodOk ? 0 : 1);
