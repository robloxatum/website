# Security audit 3 — progress

Branch: `security-audit-3` (off `main` @ 299f8d7). Started 2026-11-27. Round 1: nothing committed or applied. Round 2 (owner-approved): L-3 migration applied to production; branch to be committed, pushed and merged after CI.
Rules: local stack only for attacks; production = signed-out GET only; no migrations applied; no secrets in output.

## Done
- Tools (Homebrew): gitleaks 8.30.1, osv-scanner 2.7.1, semgrep 1.186.0 (metrics off)
- Baseline before changes: `npm test` 168/168; `npm run test:db` ALL SECURITY TESTS PASSED; `npm run test:e2e` 222 passed / 4 skipped + prod-build check
- A–G read and tested: all 21 migrations, proxy, auth, callback, signout, test sign-in, 24 Server Actions, 11 route handlers, push, crons, caching, SW, new features (Links copy, Sign up/Sign in links, RSVP↔Check in switch, locations.ts/Maps, Events tabs)
- Production signed-out GETs: auth settings, anon Data API denials, headers, redirects, test sign-in 404; 10 page responses + 16 scripts scanned for cache-function IDs (0)
- Attack scripts (local only), all in `security-audit/attacks/`:
  - `persona-matrix.mjs`: 212 checks, 0 failed
  - `realtime-spoof.mjs`: sends refused
  - `app-local.mjs`: 91 checks, 0 failed (after fixes; harness false positives E-65/67/75 corrected: raw redirect values, `/go/%2e%2e` = home page)
  - `use-cache-actions.mjs`: VULNERABLE ×4 before fix → safe ×4 after
  - `exif-check.mjs`: GPS kept (L-1)
- Supply chain: gitleaks history 0 / tree 26 (all ignored local files); npm audit 0; osv-scanner 0; semgrep custom rules triaged
- Findings register written: `05-findings.md` (M-1, L-1…L-8, I-1…I-12)
- **Fixes on branch** (uncommitted):
  - L-8: `src/proxy.ts`, `src/lib/server-reference.ts`, `src/lib/roblox.ts` arg checks; tests `tests/server-reference.test.mjs` (fails 2/7 without fix), `e2e/use-cache-actions.spec.ts`
  - I-3: `src/app/auth/signout/route.ts` Origin check; `app-local.mjs` E-61 expects 403
- After fixes: `npm test` 175/175; full e2e 224 passed / 6 skipped + prod-build check; push + use-cache specs after sign-out change 14 passed / 2 skipped
- J: restore drill (`restore-drill.mjs`) 12/12; H: preview/env reviewed (I-12, 08 V-2/V-3); I: compliance notes (03 §6)
- After all changes: `npm test` 175/175; `npm run test:db` passed; tsc clean; eslint 0/0; persona matrix 212/0; realtime spoof 0 delivered; app-local 91/0; gitleaks on new files 0
- All deliverables written: 01–10

## Round 2: owner decisions (2026-11-27)
- [x] L-3 migration applied to production (`db push --remote`, only that one pending); anon `public_past_event_counts` still `[]` (HTTP 200) before and after; remote up to date
- [x] `supabase unlink`; `security_test.sql` header → `--local`; `.env.local` left as is
- [x] M-1: avatars `unoptimized` (Avatar, FounderAvatar), `rbxcdn` pattern removed; tests
- [x] L-1: `src/lib/strip-metadata.ts` + `EventForm.tsx`; unit + e2e tests
- [x] L-6: permissions + SHA pins; `tests/ci-workflow.test.mjs`
- [x] I-10: `src/app/robots.ts`; `tests/robots.test.mjs`
- [x] L-2: privacy page text; `tests/privacy-page.test.mjs`
- [x] Winter-break to-do list in 10 §6 (L-4, L-7, purge function, rest of L-5)
- [x] `npm test` 195/195; `test:db` passed; tsc clean; eslint clean
- [x] Full e2e on the final tree: local run 223 passed / 4 failed / 9 skipped (all 4 from the new tests, fixed test-side, affected specs re-run 88 passed / 2 skipped); full suite passed in CI on dcc1adb
- [x] Commit, push, CI, merge to main, push, confirm production deploy, delete branch: dcc1adb, CI passed, merged as 53c920f; production checked with signed-out GETs (robots.txt, privacy text, optimizer 400 for rbxcdn, /about avatars direct); branch deleted

## Not done (and why)
- `e2e/use-cache-actions.spec.ts` not run against a pre-fix build (an 11-minute rebuild); the attack script covers the same requests
- Google OAuth end to end, dashboard settings, Vercel image quota, signed-in production headers: can't be done within the rules (06 §5)
