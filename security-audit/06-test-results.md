# 06 — Test results (measured)

All numbers below come from runs on 2026-11-27, on this machine against the **local** Supabase (Docker) and local builds, except the production rows, which are signed-out GETs only. Evidence files are in `security-audit/evidence/`. Logs are in the session scratchpad and are not committed.

## 1. Project suites

| Suite | Before (main @ 299f8d7) | After (branch, with fixes) |
|---|---|---|
| `npm test` (node:test unit) | 168 / 168 pass | **175 / 175 pass** (+7: `tests/server-reference.test.mjs`) |
| `npm run test:db` (`supabase/tests/security_test.sql` on local reset DB) | ALL SECURITY TESTS PASSED | **ALL SECURITY TESTS PASSED** |
| `npm run test:e2e` (Playwright, desktop + phone, E2E build) | 222 passed, 4 skipped | **224 passed, 6 skipped** (+2 run on desktop, +2 skipped on phone: `e2e/use-cache-actions.spec.ts`) |
| e2e step 5: normal production build has no test sign-in | passed | **passed** |
| e2e after the sign-out change (rebuild; `push.spec.ts` + `use-cache-actions.spec.ts`) | — | **14 passed, 2 skipped** |
| `npx tsc --noEmit` | clean | **clean** |
| `npx eslint .` | — | **0 errors, 0 warnings** |
| CI (GitHub Actions `e2e.yml`) | — | **not run**: it runs on push, and pushing needs your approval |

Regression tests fail without their fix:
- `tests/server-reference.test.mjs` with `src/proxy.ts` reverted (`git stash`): **2 of 7 fail** (the proxy-order and matcher tests); with the fix, 7/7 pass. The other 5 test the classifier itself, which is a new file.
- `security-audit/attacks/use-cache-actions.mjs`: on the pre-fix build, `VULNERABLE` ×4, exit 1; on the fixed build, `safe` ×4, exit 0.
- `e2e/use-cache-actions.spec.ts`: **not run against a pre-fix build** (that needs another 11-minute rebuild). The attack script above covers the same requests.
- Sign-out Origin check: before, `app-local.mjs` recorded a cross-origin POST with cookies as **303**, meaning sign-out ran and the refresh token was revoked. In a browser it would also clear the cookies; the harness's copied access token kept working until expiry, which is the accepted 1-hour risk. After: **403**, and nothing was revoked.

## 2. Audit attack scripts (local only)

| Script | What it does | Result |
|---|---|---|
| `persona-matrix.mjs` | 212 direct REST/RPC/Realtime/Storage/token checks across 9 personas | **212 checks, 0 failed** (before and after fixes) |
| `realtime-spoof.mjs` | member send on private `game:` with ack; REST broadcast by member and by anon to `attendance:` | sender ack `error`, listener 0, officer 0; REST 202 but **officer received 0** |
| `app-local.mjs` | caching headers, payload leaks, stored XSS, `.ics`, every officer action called directly as member/anon, CSRF origins, cache functions as actions, route handlers, cron twice, push route, sign-out CSRF, redirects, Host header, image optimizer | before: 85 checks, 7 flagged (4 real: L-8; 3 harness errors, fixed: E-65/E-67 decoded the redirect before checking it, E-75 `/go/%2e%2e` is the home page). **After: 91 checks, 0 failed** |
| `use-cache-actions.mjs` | signed-out calls of the 3 Roblox cache functions and one events cache function, upstream calls counted by a stand-in | before: 30/30 lookups, **31 upstream requests**, **5000 usernames in one upstream request**, **3000 IDs in one URL**, events 200. After: **0 upstream, 404** |
| `scratchpad/id-leak.mjs` (not kept in repo) | look for cache-function IDs in 39 live responses (13 paths × HTML / RSC / prefetch) | **0 hits**; IDs shared between the two builds: **0 of 10** cache, **0 of 24** actions; client JS: 0 cache IDs, 21 of 24 action IDs |
| `exif-check.mjs` | officer uploads a synthetic GPS-tagged JPEG; download the public object | `sameBytes: true`, EXIF, make, model, **GPS present** (L-1) |
| `restore-drill.mjs` | officer downloads `backup.zip` → delete users + events → restore from CSVs only → compare | **12/12 pass**: 4 members, 2 events, 3 check-ins, 4 RSVPs restored field-identical; accounts come back with **new IDs**; 6 kinds of data not in the backup (09/10) |

## 3. Scanners

| Tool | Scope | Result |
|---|---|---|
| gitleaks 8.30.1 | git history, all refs (99 commits) | **0 leaks** |
| gitleaks | working tree (including ignored files) | 26 hits, **all in untracked/ignored local files** (`.env.local` publishable key, `.next*` caches, `.next-e2e/e2e-vapid.json` throwaway keys); 0 in tracked files |
| `npm audit` | 512 dependencies | **0 vulnerabilities** |
| osv-scanner 2.7.1 | `package-lock.json`, 503 packages | **0 issues** |
| semgrep 1.186.0, registry packs `p/javascript`, `p/typescript`, `p/nextjs`, `p/react`, `p/secrets`, `p/owasp-top-ten`, `--metrics=off` | `src e2e scripts supabase security-audit next.config.ts` | 0 findings (the packs are taint-based and missed my bad-code sample, so I wrote project rules) |
| semgrep, project rules (`security-audit/semgrep/rules.yml`) | `src/` | 19 `href-from-data` (all triaged safe: fixed hosts, DB-constrained URLs or same-site paths), 1 `cookie-set-without-options` (proxy.ts, the Supabase SSR pattern: false positive), 0 `raw-html-sink`, 0 `secret-key-outside-push-sender`, 0 `service-role-or-secret-literal`, 0 `target-blank-without-noopener`. `server-action-without-auth-check` doesn't parse, so I used a script instead: **24/24 actions call an auth helper** |
| lockfile | `package-lock.json` v3 | integrity on all entries; all from `registry.npmjs.org`; **0 packages with install scripts** |
| Build output | `.next/static` | no source maps; no secret patterns (1 match was supabase-js key-prefix code) |
| Versions | Next 16.4.6, React 19.3.1 | at or above the November 2026 security releases (GHSA-rv78-f8rc-xrxh; CVE-2026-126187 fixed in 19.3.1) |

## 4. Production (signed-out GETs only)

| Check | Result |
|---|---|
| `/auth/v1/settings` | `google: true`; `email`, `phone`, `anonymous_users`: **false** |
| Anon Data API on 11 private tables/columns | **401** each; dropped tables **404**; `public_past_event_counts` → `[]` |
| Security headers on the public and private pages checked | CSP, HSTS (`max-age=63072000; includeSubDomains`), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy present |
| `/auth/test-sign-in` | **404** |
| `/officer/members.csv`, `backup.zip` | **403** |
| `/api/cron/reminders`, `/api/keep-alive` without the secret | **401** |
| Open redirect probes (`/go/…`, `/auth/callback?next=…`, `/login?next=…`) | all stay on `robloxatum.vercel.app` |
| Private page shells | `public, max-age=0, must-revalidate`; `/officer` shell holds only the sign-in redirect (I-2) |
| Cache-function IDs in 5 public pages (HTML + RSC) and their 16 scripts | **0** |
| `robots.txt`, `sitemap.xml` | 404 (I-10) |

Side effect: about six `GET /auth/v1/authorize?provider=google` requests (not followed to Google), each probably leaving a short-lived OAuth flow row, the same as an unfinished "Sign in" click.

## 5. Not tested, and why
- **Google OAuth end to end** (consent screen, `hd`, real umich vs gmail accounts): it can't run locally, and against production it would need real accounts. The hook and callback were tested with the local auth server and the public sign-up path.
- **Supabase redirect-URL allowlist, Vercel env scoping, preview protection, 2FA on accounts**: dashboard only (08).
- **Image-optimizer quota behavior on Vercel Hobby (M-1)**: that would be load-testing production.
- **Signed-in response headers on Vercel (I-2)**: they need a real session; checklist item V-6.
- **Load, DoS and Realtime connection limits**: out of scope by the rules; reasoned in 05 instead.

## 6. Round 2 (owner decisions, 2026-11-27)
| Check | Result |
|---|---|
| L-3 migration, `npm run test:db` without / with it | fails ("past events with fewer than 10 check-ins hide their count") / ALL SECURITY TESTS PASSED |
| Production `db push --remote --dry-run` before applying | only `20261212000000_public_counts_threshold.sql` pending |
| Production signed-out `GET /rest/v1/rpc/public_past_event_counts` before / after | `[]` HTTP 200 / `[]` HTTP 200; dry-run after: "Remote database is up to date" |
| `tests/image-optimizer.test.mjs` without / with M-1 fix | 1 pass, 3 fail / 4 pass |
| `tests/strip-metadata.test.mjs` | 10 pass (pixels compared with sharp; the round-1 GPS fixture: `Exif`, make, model present before, absent after) |
| `tests/privacy-page.test.mjs` on the old / new page | 0/3 / 3/3 |
| `tests/ci-workflow.test.mjs` on the old / new workflow | 1/3 / 3/3 |
| `tests/robots.test.mjs` | 3/3 |
| `npm test` | 195/195 |
| tsc, eslint | clean |
| Full e2e on the final app build | 223 passed, 4 failed, 9 skipped. All 4 failures came from the new tests: Next never optimizes images from local IPs (`images.dangerouslyAllowLocalIP` off), so in E2E a flyer through `/_next/image` is a 400. Fixed in the tests: the shared fixture serves optimized flyers (as `design-review.spec.ts` already did), and the untestable "flyer still optimized" request check was dropped (the unit test covers the pattern). Re-run of the affected specs (image-metadata, image-optimizer, layout-a11y, design-review, about): 88 passed, 2 skipped |
| Production build check | no test sign-in |

`app-local.mjs` now expects 400 for both `rbxcdn` optimizer URLs; it wasn't re-run in round 2.
