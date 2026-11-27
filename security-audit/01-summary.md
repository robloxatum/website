# 01 — Summary: security and privacy audit 3

**Site:** robloxatum.vercel.app (Next.js 16.4.6 on Vercel Hobby, Supabase free plan, Google sign-in for umich accounts). **Branch:** `security-audit-3` off `main` @ 299f8d7 (round 2 goes to `main` only after CI passes). **Date:** 2026-11-27, two days before the public launch.
**Method:** OWASP ASVS 5.0 L2 checklist; OWASP Top 10, API Top 10 and WSTG as method. Attacks ran only on the local stack, with synthetic `aud3…@umich.edu` users. Production got signed-out GETs only. Round 1 applied no migration and committed nothing; round 2 (owner-approved) applied one migration and merged the branch. No secret or real member data was printed.

## Bottom line
**No Critical or High issues.** The access control that matters most held up under direct attack: who can see members, check-ins, codes, game links, exports and officer powers. 212 direct database/API checks across 9 kinds of user found 0 failures, and 24 of 24 Server Actions check the caller.

What I found is mostly about **limits, leftovers and paperwork**, not broken access control:
- **M-1 (Medium, fixed):** anyone could make our image optimizer fetch arbitrary `*.rbxcdn.com` images, which can use up the free monthly allowance and break site images.
- **L-8 (Low, fixed):** Next.js lets `"use cache"` functions be called like Server Actions. That would let someone run our Roblox lookups without signing in and without the 20/min limit. I first rated this Medium; I lowered it after measuring that the needed IDs change every build and never reach visitors, including on production.
- **Privacy leftovers:** flyer photos keep GPS data (L-1); the privacy page promises a daily deletion that doesn't happen and leaves some items out (L-2); an API returns the attendance counts under 10 that the site hides (L-3, migration ready).
- **Operations:** no record of who exported member data (L-4); your laptop's tools point at production by default (L-5); CI hardening (L-6); reminders would miss devices past 1000 (L-7).
- **Recovery works:** a real `backup.zip` restored members, events, check-ins and RSVPs field for field in a local drill. Accounts come back with new IDs and site text isn't in the zip (10 §3–4).

The 1-hour token lifetime after sign-out, inline-script CSP, JS-readable cookies and the other accepted items have no new exploit. I don't think accepting any of them was a mistake.

## Fixed (round 1 on the branch; round 2 after the owner's decisions, 2026-11-27)
| ID | Change | Files | Tests |
|---|---|---|---|
| L-8 | `proxy.ts` answers 404 to any action request that names a `"use cache"` function; `roblox.ts` refuses oversized or invalid batches | `src/proxy.ts`, `src/lib/server-reference.ts`, `src/lib/roblox.ts` | `tests/server-reference.test.mjs` (fails 2/7 without), `e2e/use-cache-actions.spec.ts` |
| I-3 | Sign-out refuses a cross-site Origin | `src/app/auth/signout/route.ts` | `attacks/app-local.mjs` E-61 |
| L-3 | `public_past_event_counts()` returns only counts ≥ 10. **Applied to production**; signed-out result there `[]` before and after | `supabase/migrations/20261212000000_public_counts_threshold.sql` | `security_test.sql` (fails without) |
| M-1 | Avatars load straight from Roblox (`unoptimized`); `rbxcdn` removed from the optimizer's allowed hosts | `Avatar.tsx`, `FounderAvatar.tsx`, `next.config.ts` | `tests/image-optimizer.test.mjs` (fails 3/4 without), `e2e/image-optimizer.spec.ts`, `e2e/about.spec.ts` |
| L-1 | Flyer/cover uploads lose EXIF/GPS, XMP, comments (byte-level, no re-encode; rotation and colour profile kept); type read from the bytes | `src/lib/strip-metadata.ts`, `EventForm.tsx` | `tests/strip-metadata.test.mjs` (10), `e2e/image-metadata.spec.ts` |
| L-2 | Privacy page text matches the app (deletion timing, lookups, cookies, sharing with Roblox, retention, Google Form) | `src/app/(main)/privacy/page.tsx` | `tests/privacy-page.test.mjs` (fails 3/3 on the old page) |
| L-5 (part) | CLI unlinked; DB test header says `--local` | `supabase/tests/security_test.sql` | — |
| L-6 | CI token `contents: read`; actions pinned to commit SHAs | `.github/workflows/e2e.yml` | `tests/ci-workflow.test.mjs` (fails 2/3 on the old file) |
| I-10 | `robots.txt` keeps crawlers off signed-in, officer, sign-in and check-in pages; previews disallow all | `src/app/robots.ts` | `tests/robots.test.mjs` |

Left for winter break (10 §6): L-4 audit log, L-7 reminders past 1000 devices, the daily purge function, the rest of L-5 (`.env.local`). Still for the owner: the dashboard ★ items in 08 and a response time for deletion requests on the privacy page.

## Dashboard (measured)
| Measure | Value |
|---|---|
| Findings: Critical / High / Medium / Low / Info | 0 / 0 / 1 / 8 / 12 |
| Fixed | 9 (M-1, L-1, L-2 text, L-3, L-6, L-8, I-3, I-10; L-5 in part) |
| Migrations proposed / applied to production | 1 / 1 |
| Direct API/RPC/Realtime/Storage checks (persona matrix) | 212 run, 0 failed |
| Next.js app checks (app-local) | 91 run, 0 failed (after fixes) |
| Server Actions calling an auth helper | 24 / 24 |
| `"use cache"` functions reachable as actions | 10 before → 0 after |
| Upstream Roblox requests from 30 signed-out calls | 31 before → 0 after |
| Cache-function IDs found in served pages (local 39 responses / production 26) | 0 / 0 |
| Realtime spoof messages delivered | 0 |
| Restore drill checks | 12 / 12 passed |
| Unit tests | 168 → 195, all passing |
| DB security tests | passing |
| E2E tests | 222 passed / 4 skipped before; final tree: full run 223 passed / 4 failed / 9 skipped, the 4 fixed (test-side) and re-run 88/88 passed; full suite runs in CI |
| Dependencies with known vulnerabilities (npm audit 512 / osv 503) | 0 / 0 |
| Secrets in git history (99 commits) | 0 |
| ASVS 5.0 L2 rows: Pass / Partial / Gap / other | 25 / 12 / 6 / 3 (of 46) |

## Files
02 architecture and STRIDE · 03 data inventory and privacy · 04 access matrix and endpoints · 05 findings · 06 test results · 07 ASVS · 08 owner dashboard checklist · 09 incident response · 10 maintenance · PROGRESS.md · `attacks/` (6 local-only scripts) · `evidence/` (JSON results) · `semgrep/rules.yml`.
