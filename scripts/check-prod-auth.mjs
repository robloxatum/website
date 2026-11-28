#!/usr/bin/env node
// CI guard: production must allow Google sign-in only. Fails if the live auth
// settings allow email, phone or anonymous sign-in (for example after someone
// ran `supabase config push` with the local supabase/config.toml, which turns
// email/password on for the end-to-end tests).
//
// Reads Supabase's public /auth/v1/settings endpoint with the publishable key.
// Read-only: it changes nothing.   Run: node scripts/check-prod-auth.mjs

import { pathToFileURL } from "node:url";

// Production's project URL and PUBLISHABLE key. Both are public by design: every
// visitor's browser downloads them from the live site. (Never the secret key.)
// If the key is rotated, update it here (or set PROD_SUPABASE_URL /
// PROD_SUPABASE_PUBLISHABLE_KEY); the check fails closed until then. The
// gitleaks:allow marks this one public key for the monthly secrets scan.
export const PROD_SUPABASE_URL = "https://swegqrnmbqflzhczbhou.supabase.co";
export const PROD_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UJTeCwJTjST--5EL__taHA_TQvoaQLz"; // gitleaks:allow (public key)

/** Sign-in methods that must never be on in production. */
export const FORBIDDEN = ["email", "phone", "anonymous_users"];

/** What's wrong with these auth settings (empty: all good). Unreadable settings count as wrong. */
export function authSettingsProblems(settings) {
  const external = settings?.external;
  if (!external || typeof external !== "object") return ["Couldn't read the auth settings (no `external` providers list)."];
  const problems = FORBIDDEN.filter((k) => external[k] !== false).map((k) =>
    k in external ? `${k} sign-in is ON in production (expected off).` : `${k}: missing from the settings (expected false).`,
  );
  return problems;
}

/** Production's URL and publishable key (overridable by env). Refuses anything else. */
export function productionTarget(env = process.env) {
  const url = env.PROD_SUPABASE_URL || PROD_SUPABASE_URL;
  const key = env.PROD_SUPABASE_PUBLISHABLE_KEY || PROD_SUPABASE_PUBLISHABLE_KEY;
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) throw new Error(`Not a production Supabase URL: "${url}"`);
  if (!key.startsWith("sb_publishable_")) throw new Error("Expected the publishable (public) key, sb_publishable_…");
  return { url, key };
}

async function fetchSettings({ url, key }, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const target = productionTarget();
    const problems = authSettingsProblems(await fetchSettings(target));
    if (problems.length) {
      console.error(`✖ Production auth settings (${target.url}):\n  - ${problems.join("\n  - ")}`);
      console.error("  Turn these off in Supabase → Authentication → Sign In / Providers. Never run `supabase config push`.");
      process.exit(1);
    }
    console.log(`✓ Production allows no email, phone or anonymous sign-in (${target.url}).`);
  } catch (err) {
    // Fail closed: if we can't check, CI doesn't pass.
    console.error(`✖ Couldn't check production auth settings: ${err.message}`);
    process.exit(1);
  }
}
