// CI guard (scripts/check-prod-auth.mjs): production allows no email, phone or
// anonymous sign-in. The live check runs in CI; these test the rules. Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { authSettingsProblems, productionTarget } from "../scripts/check-prod-auth.mjs";

const googleOnly = { external: { google: true, email: false, phone: false, anonymous_users: false, apple: false } };

describe("authSettingsProblems", () => {
  it("Google only: no problems", () => {
    assert.deepEqual(authSettingsProblems(googleOnly), []);
  });

  it("flags email, phone or anonymous sign-in when on", () => {
    for (const k of ["email", "phone", "anonymous_users"]) {
      const problems = authSettingsProblems({ external: { ...googleOnly.external, [k]: true } });
      assert.equal(problems.length, 1, k);
      assert.match(problems[0], new RegExp(`^${k} sign-in is ON`));
    }
    assert.equal(authSettingsProblems({ external: { google: true, email: true, phone: true, anonymous_users: true } }).length, 3);
  });

  it("fails closed: missing or unreadable settings count as problems", () => {
    assert.match(authSettingsProblems({ external: { google: true, phone: false, anonymous_users: false } })[0], /^email: missing/);
    assert.match(authSettingsProblems({ external: { ...googleOnly.external, email: "false" } })[0], /^email sign-in is ON/);
    for (const bad of [null, undefined, {}, { external: null }, { external: "x" }, { message: "Invalid API key" }]) {
      assert.equal(authSettingsProblems(bad).length, 1, JSON.stringify(bad));
    }
  });
});

describe("productionTarget", () => {
  it("defaults to the hosted project and its publishable key", () => {
    const { url, key } = productionTarget({});
    assert.match(url, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
    assert.ok(key.startsWith("sb_publishable_"));
  });

  it("refuses anything but a hosted URL and the publishable key (never the secret key, never local)", () => {
    assert.throws(() => productionTarget({ PROD_SUPABASE_URL: "http://127.0.0.1:54321" }), /Not a production/);
    assert.throws(() => productionTarget({ PROD_SUPABASE_URL: "https://evil.example.com" }), /Not a production/);
    assert.throws(() => productionTarget({ PROD_SUPABASE_PUBLISHABLE_KEY: "sb_secret_x" }), /publishable/);
    assert.deepEqual(productionTarget({ PROD_SUPABASE_URL: "https://abc.supabase.co", PROD_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_y" }), {
      url: "https://abc.supabase.co",
      key: "sb_publishable_y",
    });
  });

  it("the committed key is never a secret key", () => {
    const src = readFileSync(new URL("../scripts/check-prod-auth.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(src, /sb_secret_[A-Za-z0-9]/);
    assert.doesNotMatch(src, /eyJ[A-Za-z0-9_-]{10,}\./); // no legacy service_role JWT
  });
});

describe("CI runs the guard", () => {
  it("the workflow runs scripts/check-prod-auth.mjs", () => {
    const yml = readFileSync(new URL("../.github/workflows/e2e.yml", import.meta.url), "utf8");
    assert.match(yml, /run: node scripts\/check-prod-auth\.mjs/);
  });

  it("supabase/config.toml warns that [auth.email] is for the local stack only", () => {
    const toml = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
    const section = toml.slice(toml.indexOf("[auth.email]"), toml.indexOf("\n[", toml.indexOf("[auth.email]") + 1));
    assert.match(section, /LOCAL STACK ONLY\. NEVER PUSH THIS TO PRODUCTION/);
    assert.match(section, /never run `supabase config push`/);
  });
});
