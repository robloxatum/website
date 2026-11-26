// Supabase auth cookies: Secure in production builds only. Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { authCookieOptions, secureAuthCookies } from "../src/lib/supabase/cookie-options.ts";

describe("auth cookie options", () => {
  it("Secure only for Vercel production builds (not previews, next dev or the localhost E2E build)", () => {
    assert.equal(secureAuthCookies("production"), true);
    for (const env of ["preview", "development", "", undefined]) assert.equal(secureAuthCookies(env), false, String(env));
  });

  it("SameSite=Lax on the whole site, Secure as decided at build time", () => {
    assert.deepEqual(authCookieOptions(true), { secure: true, sameSite: "lax", path: "/" });
    assert.deepEqual(authCookieOptions(false), { secure: false, sameSite: "lax", path: "/" });
  });

  it("regression: every Supabase client that sets auth cookies uses them", () => {
    // Browser client, server client (pages, actions, routes) and the session-refreshing proxy.
    for (const file of ["src/lib/supabase/client.ts", "src/lib/supabase/server.ts", "src/proxy.ts"]) {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      assert.match(src, /cookieOptions: authCookieOptions\(\)/, file);
    }
    const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
    assert.match(config, /AUTH_COOKIE_SECURE: secureAuthCookies\(process\.env\.VERCEL_ENV\) \? "1" : ""/, "next.config.ts inlines the decision");
  });
});
