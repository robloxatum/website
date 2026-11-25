#!/usr/bin/env node
// Proves a normal production build (no E2E_TEST_AUTH) has no test sign-in:
//   - the route isn't in the build's route manifests,
//   - no server file mentions it,
//   - the running server answers 404.
// Run by scripts/e2e.mjs after the Playwright tests, and in CI.

import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROUTE = "/auth/test-sign-in";
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
delete env.E2E_TEST_AUTH;
delete env.E2E_TEST_PASSWORD;

const fail = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

const build = spawnSync("npx", ["next", "build"], { stdio: "inherit", env });
if (build.status !== 0) fail("production build failed");

const manifests = ["app-paths-manifest.json", "app-path-routes-manifest.json"]
  .map((f) => join(".next/server", f))
  .concat(".next/routes-manifest.json")
  .filter((f) => {
    try {
      return statSync(f).isFile();
    } catch {
      return false;
    }
  });
for (const f of manifests) {
  if (readFileSync(f, "utf8").includes("test-sign-in")) fail(`${f} lists the test sign-in route`);
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}
for (const f of files(".next/server")) {
  if (/\.(js|json|html|rsc|meta|body)$/.test(f) && readFileSync(f, "utf8").includes("test-sign-in")) {
    fail(`${f} mentions the test sign-in route`);
  }
}

// Served the way production runs: no E2E variables. (Setting E2E_TEST_AUTH here
// would make next.config.ts point `next start` at the .next-e2e build instead.)
const port = 3201;
const server = spawn("npx", ["next", "start", "-p", String(port)], { env, stdio: "ignore", detached: true });
try {
  let status = 0;
  for (let i = 0; i < 60 && !status; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`http://localhost:${port}${ROUTE}?email=a@umich.edu`, { redirect: "manual" });
      status = res.status;
    } catch {}
  }
  if (status !== 404) fail(`${ROUTE} answered ${status || "nothing"} on a production build (expected 404)`);
} finally {
  // The whole group: killing npx alone leaves next-server running on the port.
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}

console.log(`✔ Production build has no test sign-in (${manifests.length} manifests and every server file checked; ${ROUTE} is a 404).`);
