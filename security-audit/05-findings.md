# 05 — Findings register

Audit 3 · branch `security-audit-3` off `main` @ 299f8d7 · 2026-11-27.

**No Critical or High findings.** One Medium is open and needs a decision (M-1). Two Low/Info items are fixed on the branch (L-8, I-3). Everything else is Low or Info, with plans.

Labels: **confirmed exploitable** (I ran the attack and it worked), **confirmed missing control** (the control is absent, shown by test or code, but the harm is limited), **needs verification** (likely, but some part can't be checked from here), **defense-in-depth** (nothing exploitable today).

CVSS 4.0 vectors are given for Medium and above. Scores were looked up by hand, not calculated by a tool; check them in the FIRST calculator before quoting them.

None of the owner's accepted risks has a new exploit, and I don't think accepting any of them was a mistake. One interaction to know about: the accepted "CSP allows inline scripts" plus the accepted "auth cookies are JS-readable" together mean any future XSS steals sessions. No XSS was found (E-section stored-payload tests, semgrep `raw-html-sink`: 0 hits), so this stays accepted.

| ID | Title | Severity | Label | Status |
|---|---|---|---|---|
| M-1 | Image optimizer fetches any `*.rbxcdn.com` URL for anyone (quota exhaustion) | Medium | needs verification | **Fixed** (avatars `unoptimized`, pattern removed) |
| L-1 | Uploaded flyers keep EXIF, including GPS, on a public URL | Low | confirmed missing control | **Fixed** (`src/lib/strip-metadata.ts`) |
| L-2 | Privacy page doesn't match what the app does | Low | confirmed missing control | **Text fixed**; purge function: winter break |
| L-3 | `public_past_event_counts()` gives anyone the counts the site hides (under 10) | Low | confirmed exploitable | **Fixed**: migration applied to production 2026-11-27 |
| L-4 | No audit trail for exports, role changes or check-in removals | Low | confirmed missing control | Open: winter break (10 §6) |
| L-5 | Dev laptop is wired to production (CLI linked, `.env.local`, test-file instructions) | Low | confirmed missing control | **Partly fixed** (CLI unlinked, test header `--local`); `.env.local`: winter break |
| L-6 | CI: actions pinned by tag, token permissions not declared | Low | confirmed missing control | **Fixed** |
| L-7 | Reminder cron reads at most 1000 devices | Low | confirmed missing control | Open: winter break (10 §6) |
| L-8 | `"use cache"` functions run as Server Actions for anyone who has their ID (Roblox lookups without sign-in or limit) | Low | confirmed exploitable with the ID | **Fixed** |
| I-1 … I-12 | Info items | Info | various | see below |

---

## M-1 — Image optimizer fetches any `*.rbxcdn.com` URL for anyone

- **Severity:** Medium (provisional). **Confidence:** medium. **CWE:** CWE-770.
- **CVSS 4.0:** `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:L/SC:N/SI:N/SA:N` ≈ 6.9.
- **Files:** `next.config.ts:57` (`robloxImages = [{ hostname: "**.rbxcdn.com", pathname: "/**" }]`), `:90`; `src/components/ui/Avatar.tsx:40`.
- **Attacker:** signed-out visitor.
- **Reproduction (local):** `app-local.mjs` F-88/F-89: `GET /_next/image?url=https://tr.rbxcdn.com/<any path>&w=64&q=75` is accepted, and the server fetches the upstream URL. Each distinct `url × w × q` is a new source transformation.
- **What I couldn't verify:** what Vercel Hobby does when the monthly image-transformation allowance runs out. It may pause optimization, so `/_next/image` fails and flyers, covers and avatars break site-wide until the next cycle. I didn't test this on production: that would be load-testing.
- **Impact:** a script that loops over made-up `rbxcdn.com` paths and widths burns the free allowance, and site images may break. No data exposure.
- **Fix (done, owner-approved 2026-11-27):** `unoptimized` on the `<Image>` in `src/components/ui/Avatar.tsx` and `src/components/content/FounderAvatar.tsx` (full-body founder avatars also came from `*.rbxcdn.com`), and `robloxImages` removed from `remotePatterns` in `next.config.ts`. Flyers and covers stay optimized (pattern limited to the `event-flyers` bucket). Avatars now load straight from Roblox's CDN; the CSP already allowed `*.rbxcdn.com`.
- **Regression test (done):** `tests/image-optimizer.test.mjs` (fails 3/4 without the fix); `e2e/image-optimizer.spec.ts` (`/_next/image` answers 400 for three `rbxcdn` URLs); `e2e/about.spec.ts` now expects the raw CDN URL; `app-local.mjs` expects 400 for both `rbxcdn` URLs.

## L-1 — Uploaded flyers keep EXIF, including GPS, on a public URL

- **Severity:** Low. **Confidence:** high. **CWE:** CWE-212 (Improper Removal of Sensitive Information Before Storage or Transfer).
- **Files:** `src/app/(officer)/officer/_components/EventForm.tsx:41` (`uploadImage` uploads the `File` as is).
- **Attacker:** anyone who views a flyer; the risk lands on the officer who took the photo.
- **Reproduction (local):** `node security-audit/attacks/exif-check.mjs` uploads a synthetic JPEG with camera make, model and GPS tags as an officer, then downloads the public URL: `{"sameBytes":true,"exifHeader":true,"make":true,"model":true,"gpsRef":true}`.
- **Impact:** a phone photo used as a flyer or cover can reveal where it was taken (for example an officer's home) and the device. `next/image` strips metadata from optimized copies, but the original stays public at `/storage/v1/object/public/event-flyers/...`.
- **Fix (done):** `src/lib/strip-metadata.ts` removes EXIF, XMP, IPTC, comments and PNG text/eXIf chunks byte by byte (no re-encoding, so no quality loss and no canvas size limits), keeps colour profiles, and keeps a JPEG's rotation as a minimal EXIF block so phone photos stay upright. `uploadImage` in `EventForm.tsx` also takes the type from the file's bytes, not its name, and refuses a file it can't parse rather than uploading the metadata. Client-side by design: officers upload straight to Storage, and the risk is an officer's own photo, not a hostile officer.
- **Regression test (done):** `tests/strip-metadata.test.mjs` (10 tests: baseline and progressive JPEG, rotation kept, ICC kept, appended second picture dropped, truncated files refused, PNG, WebP, type sniffing; pixels compared with sharp); `e2e/image-metadata.spec.ts` uploads a GPS-tagged JPEG as flyer and cover through the officer form and checks the public objects.

## L-2 — Privacy page doesn't match what the app does

- **Severity:** Low. **Confidence:** high. **CWE:** CWE-1059 (Insufficient Technical Documentation).
- **File:** `src/app/(main)/privacy/page.tsx`.
- **Mismatches (each checked in code):**
  1. Line 49: "The times of wrong check-in codes … are deleted after a day." In fact, rows older than a day are deleted only the next time **that member** calls `check_in()` (`20261211000000_db_hardening.sql:135`). A member who never checks in again keeps them indefinitely.
  2. Not mentioned: `private.roblox_lookups` (a timestamp per Roblox lookup per member, purged on that member's next lookup, `db_hardening.sql:246`).
  3. Line 101: "The only cookie keeps you signed in. Your browser also remembers announcements you closed". The install bar also stores a localStorage key; the sign-in flow also sets a short-lived PKCE verifier cookie.
  4. Not covered: data outside the app that members give the club (the "Get event updates" Google Form and Sheet, the public Google Calendar), and exported CSV/ZIP files on officers' devices.
  5. No retention period for profiles, attendance and RSVPs, and no statement of what happens when a member graduates.
  6. Roblox usernames are sent to Roblox's API by our server (lines 44–45 say "we look up from Roblox's public API", which is accurate but doesn't say the username leaves the site). Every avatar view also sends the viewer's IP to Roblox's CDN.
- **Fix (text done):** the privacy page now says when wrong-code and Roblox-lookup times are really deleted, lists the lookup times, the sign-in cookie and the install-bar setting, adds "Who we share it with" (Roblox username to Roblox; avatar images from Roblox's servers see your IP) and "How long we keep it", and mentions the Google Form. **Winter break:** a daily purge function (then the page can say "after a day" again); a response time for deletion requests is left to the owner.
- **Regression test (done):** `tests/privacy-page.test.mjs`: every table in the migrations must be mapped to words on the page or marked as holding no personal data, so a new table fails until the page is updated (fails 3/3 on the old page).

## L-3 — `public_past_event_counts()` gives anyone the counts the site hides

- **Severity:** Low. **Confidence:** high. **CWE:** CWE-359 (Exposure of Private Personal Information to an Unauthorized Actor).
- **Files:** `supabase/migrations/20261124020000_redesign_public_data.sql:38-55`; the threshold exists only in the app at `src/lib/events.ts:8,32` (`MIN_PUBLIC_COUNT = 10`).
- **Attacker:** signed-out visitor with the public key (it's in the page).
- **Reproduction (local):** persona matrix F-189: anon `POST /rest/v1/rpc/public_past_event_counts` returns every ended event's count, including counts of 1–9. In production it currently returns `[]` (no ended events yet).
- **Impact:** small. Counts alone name no one, but for a tiny event ("2 attended") combined with outside knowledge ("I know Alex went"), they say more than the site means to show. The owner's stated rule is "counts under 10 are hidden".
- **Fix (migration `20261212000000_public_counts_threshold.sql`, applied to production 2026-11-27 with owner approval; anon result there still `[]`):**
  ```sql
  -- 20261212000000_public_counts_threshold.sql
  create or replace function public.public_past_event_counts()
  returns table (event_id uuid, attendance int)
  language sql stable security definer set search_path = ''
  as $$
    select a.event_id, count(*)::int
      from public.attendance a
      join public.events e on e.id = a.event_id
     where e.ends_at <= now()
     group by a.event_id
    having count(*) >= 10
  $$;
  ```
  Same signature, so grants are kept and the app needs no change (its filter becomes redundant). Order: apply to production first, then merge.
- **Regression test (done):** `supabase/tests/security_test.sql`: an ended event with 1 check-in isn't in the anon result; one with 10 is (fails without the migration).

## L-4 — No audit trail for exports, role changes or check-in removals

- **Severity:** Low. **Confidence:** high. **CWE:** CWE-778 (Insufficient Logging).
- **Files:** `src/app/(officer)/officer/members.csv/route.ts`, `events/[id]/attendance.csv/route.ts`, `backup.zip/route.ts`; `set_officer`, `removeAttendance`.
- **What's missing:** nothing records who downloaded the full member list, who made or removed an officer, or who deleted a check-in. `events.created_by` and `event_game_servers.updated_by` can be set to any value by an officer through the API (I-9). Vercel Hobby keeps runtime logs only briefly.
- **Impact:** after a leak or a dispute ("who removed my check-in?"), the owner can't find out what happened.
- **Fix (plan):** an `private.audit_log (at, actor, action, target)` table written by `set_officer`, a `log_export()` RPC called by the three routes, and a trigger on attendance delete. Officers read it; nobody can update or delete rows. Needs a migration (to be shown first). About 60 lines plus a page.
- **Regression test:** DB test: exporting writes a row; a member can't read or write the log; an officer can't delete rows.

## L-5 — Dev laptop is wired to production

- **Severity:** Low. **Confidence:** high. **CWE:** CWE-653 (Improper Isolation or Compartmentalization).
- **Evidence:** `npx supabase status` and `supabase/.temp/project-ref` show the CLI **linked to the production project**, so any `supabase db push`, `db reset --linked` or `db query --linked` without `--local` hits production. `.env.local` points `next dev` at the production database (so local testing writes real data). `supabase/tests/security_test.sql`'s header says to run it with `--linked`. It runs in a transaction that rolls back, but it still writes test rows to production while it runs and fires triggers (Realtime broadcasts).
- **Impact:** one mistyped command changes or wipes production. No attacker needed.
- **Fix:** done 2026-11-27: `supabase unlink` (re-link only to run `db push --remote`, 10 §1); the test header says `--local`. Winter break (10 §6): point `.env.local` at local Supabase for development and keep a separate `.env.production.local` used only on purpose. This also needs the memory note "localhost and Vercel share the production Supabase" updated.
- **Regression test:** none practical; the checklist in 10-maintenance.md covers it.

## L-6 — CI: actions pinned by tag, token permissions not declared

- **Severity:** Low. **Confidence:** high. **CWE:** CWE-1357 (Reliance on Insufficiently Trustworthy Component), CWE-250.
- **File:** `.github/workflows/e2e.yml:3,14,15,30`.
- **What's missing:** `actions/checkout@v7`, `setup-node@v7` and `upload-artifact@v7` are tags (mutable); there's no `permissions:` block, so the default `GITHUB_TOKEN` permissions apply (read-write if the repo's default was never changed). The trigger is `on: push` only (no `pull_request_target`, which is good), and no secrets are used.
- **Fix (done):** `permissions: contents: read`; `actions/checkout@3d3c42e…` (v7.0.1, with `persist-credentials: false`), `setup-node@949feb2…` (v7.1.0), `upload-artifact@cf430e0…` (v7.0.2). Still to do on GitHub: set the repo default token to read-only (08 H-3).
- **Regression test (done):** `tests/ci-workflow.test.mjs`: read-only `permissions`, no `write`, no `pull_request_target`, every `uses:` pinned to 40 hex (fails 2/3 on the old workflow).

## L-7 — Reminder cron reads at most 1000 devices

- **Severity:** Low (reliability). **Confidence:** medium. **CWE:** CWE-1284/CWE-400 (not a security bug; included so it isn't lost).
- **File:** `src/lib/push/send.ts:139` (`select(...).eq("event_reminders", true)` with no paging). PostgREST `max_rows = 1000` (`supabase/config.toml:19`, and the hosted default) silently cuts the list.
- **Impact:** above 1000 subscribed devices (100+ members with several devices each), some members silently get no reminders. `:108` sends a long `in()` list of user IDs in the URL for game-link pushes and could hit URL length limits at several hundred check-ins.
- **Fix (plan):** page with `.range()` until fewer than 1000 rows come back; split the `in()` list into chunks of 200.
- **Regression test:** unit test with a fake client returning 1000 + 5 rows.

## L-8 — `"use cache"` functions run as anonymous Server Actions

- **Severity:** Low. I first rated this Medium, then lowered it after checking whether an outsider can get the IDs (they can't today, see "Who can do it").
- **Confidence:** high that the mechanism works; high that visitors can't see the IDs in this build.
- **CWE:** CWE-306 (Missing Authentication for Critical Function), CWE-770 (Allocation of Resources Without Limits or Throttling).
- **Label:** confirmed exploitable **with the ID**; defense-in-depth in practice.
- **Files:** `src/lib/roblox.ts` `lookupRobloxUser`, `avatarBatch`, `idsForUsernames`; every `"use cache"` function in `src/lib/events.ts`, `announcements.ts`, `site-content-data.ts`. Fix: `src/proxy.ts:13-19` and the matcher, `src/lib/server-reference.ts`, `src/lib/roblox.ts` (argument checks).
- **Attacker:** anyone holding the build's server manifest or server code (a Vercel team member, a leaked build artifact, or a future Next.js change that exposes the IDs), with no sign-in needed.
- **What happens:** Next.js 16 gives every `"use cache"` function a 42-hex server reference ID, kept in the same manifest as Server Actions. The top bit of the first byte marks it as a cache function (`next/dist/shared/lib/server-reference-info.js`). Next's action handler runs whatever ID a POST names in `Next-Action`, cache function or not, and a cache function has no auth check of its own (it isn't meant to be an endpoint).
- **Who can do it (measured):**
  - The IDs change with every build. `.next` and `.next-e2e` share 0 of 10 cache IDs and 0 of 24 action IDs; that fits Next salting them per build, and this repo doesn't set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
  - They never reach a visitor. 0 hits in `static/` (client JS) for both builds, 0 in prerendered HTML/RSC, and 0 in 39 live responses (13 paths × HTML / RSC / prefetch) from the local build.
  - On production, with read-only GETs of 5 public pages (HTML + RSC) and the 16 scripts they load: 0 IDs with the cache bit set.
  - Guessing one means guessing about 160 bits.
  
  So today, a signed-out stranger can't do this. Real Server Action IDs, by contrast, are public (21 of 24 are in client JS) and each one checks the caller.
- **Reproduction (local only):** `node security-audit/attacks/use-cache-actions.mjs`. It starts the E2E build on :3202 with Roblox replaced by a counting stand-in on :3297, then sends signed-out POSTs to `/about` with the cache functions' IDs:
  1. `lookupRobloxUser("<fresh name>")` 30 times: 30/30 results; **31 upstream Roblox requests** (the app's own path needs sign-in and allows 20 per minute per member through `take_roblox_lookup()`).
  2. `idsForUsernames([5000 names])`: **one upstream request carrying 5000 usernames (58,956 bytes)**. The app itself batches 100.
  3. `avatarBatch([3000 ids], "headshot")`: one upstream URL with 3000 IDs (13,979 bytes).
  4. `events.ts` cache function: HTTP 200 with an action result.
- **Evidence:** before the fix, the run above printed `VULNERABLE` ×4 (exit 1). After the fix: `safe` ×4, 0 upstream requests, HTTP 404 (exit 0). See `security-audit/evidence/use-cache-actions.json`. `app-local.mjs` E-38–E-41 showed the same before the fix.
- **Impact (if someone has an ID):** they can make our Vercel functions call Roblox as often as they like, with arguments they choose, bypassing sign-in and the 20/min limit. Possible results: Roblox rate-limits or blocks requests from our deployment, so avatar lookups and profile saves show "Roblox unavailable" (failures are cached for a minute, `cacheFailure()`); Vercel Hobby function-time and data-cache usage go up; very large request bodies. No data is disclosed: the public cache functions return only public data, and the Roblox ones return public Roblox data. Integrity isn't affected: the cache key includes the arguments, so an attacker can't overwrite what pages read with different content.
- **Fix (on branch):**
  1. `proxy.ts` answers **404** to any request whose `Next-Action` header is a cache-function ID, before anything else. A second matcher entry `{ source: "/:path*", has: [{ type: "header", key: "next-action" }] }` makes the proxy run for every action request, including paths the main matcher skips (for example a page path ending in `.png`, `/events/x.png`).
  2. Defense in depth in `roblox.ts`: `avatarBatch` and `idsForUsernames` now refuse anything except 1–100 valid IDs or usernames and a known `kind`, and return `{}` without calling Roblox.
  
  Real Server Actions are unaffected (their top bit is 0; the test checks every ID in both build manifests).
- **Effort:** done (about 40 lines). Easy to drop if you'd rather not carry it: it's a separate commit-sized change (proxy + `server-reference.ts` + two tests).
- **Regression tests:** `tests/server-reference.test.mjs` (7 tests: agrees with Next's own decoder for all 256 first bytes; classifies every ID in `.next` and `.next-e2e`; proxy check comes first; matcher entry present). It **fails without the fix** (2 of 7 failed with `src/proxy.ts` stashed). `e2e/use-cache-actions.spec.ts`: every cache function on `/about`, `/events/aud3.png` and `/` gives 404, and a real action (`checkIn`) still answers. The attack script itself (`use-cache-actions.mjs`) exits non-zero if anything is reachable.
- **Residual:** this relies on Next's ID format. If a Next upgrade changes it, the unit test fails (it compares against Next's decoder and the real manifests). Worth reporting upstream to Next.js (cache functions shouldn't be reachable as actions); I didn't contact anyone.

---

## Info

| ID | Title | CWE | Label | Evidence / note | Suggested action |
|---|---|---|---|---|---|
| I-1 | Former officer's already-open `attendance:<id>` channel keeps receiving counts until it rejoins | CWE-613 | confirmed (count only) | C-156: 1 message after removal; rejoin refused C-157 | Accept (counts only); or have the trigger stop sending to a removed officer by forcing a reconnect |
| I-2 | On Vercel, private pages' prerendered shell is `public, max-age=0, must-revalidate` | CWE-525 | needs verification | Production GET (signed out); the shell has no personal data (`/officer` shell holds only the redirect); locally the full response is `private, no-store` | Owner checks the signed-in response header once in the browser (08 V-6) |
| I-3 | Sign-out had no Origin check (logout CSRF) | CWE-352 | fixed on branch | `src/app/auth/signout/route.ts`; `app-local.mjs` now expects 403 | Done (5 lines); SameSite=Lax already blocked it in browsers |
| I-4 | Hook and `is_umich` use `LIKE '%@umich.edu'` (accepts `a@evil.com@umich.edu`, `@umich.edu`) and don't check `email_verified`/`hd` | CWE-1286 | defense-in-depth | `init.sql:27,87,122`; Google only issues valid addresses and the email provider is off | When next touching auth: `email ~ '^[a-z0-9._-]+@umich\.edu$'` and check `email_verified` |
| I-5 | A shared check-in code or QR link lets someone check in remotely; `/checkin?code=` submits on open | CWE-841 | by design | `CheckinClient.tsx`; codes change on regenerate | Officers regenerate the code after showing it; optional "check-in closes 15 min after start" |
| I-6 | `full_name` (from Google) has no character rule; shown only to officers, escaped by React | CWE-20 | defense-in-depth | E-section | None needed |
| I-7 | Private Roblox server links still work on Roblox after the event | CWE-613 | by design | outside the app | Officers regenerate private-server links after each event (10-maintenance) |
| I-8 | A signed-in member who hasn't finished their profile can check in and RSVP | CWE-841 | confirmed (by design?) | C-60, C-61 | Owner decides; no data risk |
| I-9 | Officer UUIDs readable via `events.created_by`/`event_game_servers.updated_by` to signed-in users; officers can set those columns to anything | CWE-359 | confirmed | anon gets 401; authenticated can read; UUIDs alone identify no one without the profiles table (officer-only) | Fold into L-4 (server-set attribution) |
| I-10 | No `robots.txt`; `/profile`, `/welcome`, `/checkin` have no `noindex` (they redirect signed-out visitors anyway); Storage objects have no `nosniff` (MIME limited to images) | CWE-200 | defense-in-depth | production GETs | **Done**: `src/app/robots.ts` (also `/play`, `/login`, `/api/`; previews disallow all); `tests/robots.test.mjs` |
| I-11 | Free-plan Realtime connection limit can be used up with the public key; `game:`/`attendance:` public (non-private) channels of the same name can be joined but carry nothing | CWE-770 | theoretical | the app falls back to polling | Accept |
| I-12 | Preview deployments: cookies aren't `Secure` (`VERCEL_ENV !== "production"`); which DB and keys previews get is unknown from the repo | CWE-614 | needs verification | `src/lib/supabase/cookie-options.ts` | 08 checklist V-2/V-3 (previews should point at no DB, or turn previews off) |

## Not applicable (one line each)
- **Passwords / password reset / credential stuffing:** none; Google OAuth only (email provider off in production).
- **MFA:** delegated to Google (and U-M's Duo for umich accounts).
- **Email sending:** the app sends none.
- **Payments:** none.
- **Webhooks (inbound):** none; the only inbound machine calls are Vercel Cron with a bearer secret.
- **GraphQL:** the app doesn't use it, and `pg_graphql` isn't enabled in the migrations (local `/graphql/v1` answers "pg_graphql extension is not enabled"). I didn't check production, because that needs a POST; confirm in the dashboard (08 S-9).
- **Containers / servers we run:** none in production (Vercel and Supabase are managed).
- **File parsing on the server:** none (uploads go browser → Storage; the server never decodes images except Next's optimizer).
