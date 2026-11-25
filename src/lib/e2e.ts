// End-to-end test mode (npm run test:e2e). Only ever on when ALL of these hold:
//  - E2E_TEST_AUTH=1 (set by scripts/e2e.mjs, never on Vercel),
//  - the Supabase URL is on this machine (a local test database),
//  - not running on Vercel.
// next.config.ts refuses to build with E2E_TEST_AUTH=1 otherwise, and the
// test-only routes (*.e2e.ts) are only compiled into E2E builds at all.
// No runtime imports: the unit tests run this file directly with Node.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLocalUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && LOCAL_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export function e2eEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env["E2E_TEST_AUTH"] === "1" && !env["VERCEL"] && isLocalUrl(env["NEXT_PUBLIC_SUPABASE_URL"]);
}
