# 04 — Access matrix and endpoint inventory

Every row was tested by calling the API, RPC, Server Action, Realtime channel or Storage **directly**, on the **local** stack, with synthetic users (`aud3…@umich.edu`). Test IDs point to `security-audit/evidence/persona-matrix.json` (212 checks, `persona-matrix.mjs`) and `security-audit/evidence/app-local.json` (`app-local.mjs`). ✅ = allowed (and expected), ⛔ = refused (and expected), ⚠ = see note. Nothing here was run against production except the signed-out GETs in section 4.

Personas: **V** signed-out visitor · **X** non-umich account (valid session, `@gmail.com` email claim; made by changing the email in SQL, as if the hook were off) · **F** signed-in, no finished profile (`onboarded_at` null) · **M** member · **M2** a second member targeting M · **O** officer · **W** owner · **R** former officer, same JWT and open Realtime channel from before removal · **T** expired / tampered / signed-out token.

## 1. Persona matrix

| Operation (direct) | V | X | F | M | M2→M | O | W | R | T |
|---|---|---|---|---|---|---|---|---|---|
| Read `profiles` (list/count/by id) | ⛔ C-12/14 | own row only C-23–26 | own only C-19–22 | own only | ⛔ C-16 | ✅ all C-148 | ✅ | ⛔ others C-153 | ⛔ 401 B-205–208 |
| Read `member_attendance` view | ⛔ C-13 | own only | own only | own only C-17 | ⛔ | ✅ | ✅ | ⛔ | ⛔ |
| Update own nickname / Roblox username | ⛔ | ⛔ 0 rows C-36 | ✅ | ✅ (Unicode tricks/HTML ⛔ E-37–41) | ⛔ others' C-27, C-42 | ⛔ others' C-141 | ⛔ others' | ✅ own | ⛔ |
| Update `is_officer`/`is_owner`/`uniqname`/`id`/`created_at` | ⛔ | ⛔ | ⛔ | ⛔ C-28–32 | ⛔ | ⛔ C-139/140 | ⛔ (SQL only) | ⛔ | ⛔ |
| Update `full_name` | ⛔ | ⛔ | ignored | ignored C-33 | ⛔ | ignored | ignored | ignored | ⛔ |
| Insert/delete a profile | ⛔ | ⛔ | ⛔ | ⛔ C-34/35 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `check_in(code)` | ⛔ C-63 | `not_umich` C-62 | ✅ ⚠ I-8 C-61 | ✅ once C-09/F-10 | n/a (no user param) | ✅ | ✅ | ✅ | ⛔ |
| Insert `attendance` directly | ⛔ | ⛔ | ⛔ | ⛔ C-45 | ⛔ C-46 | ⛔ (no INSERT grant) | ⛔ | ⛔ | ⛔ |
| Read/delete `attendance` | ⛔ C-43 | own | own | own; delete ⛔ C-47 | ⛔ C-44/48 | ✅ read all / delete | ✅ | own only | ⛔ |
| Read `event_codes` | ⛔ C-52 | ⛔ C-51 | ⛔ C-50 | ⛔ C-49 | ⛔ | ✅ C-53 | ✅ | ⛔ C-152 | ⛔ |
| `regenerate_event_code`, `set_checkin_open` | ⛔ D-197/198 | ⛔ | ⛔ | ⛔ C-97/98 | ⛔ | ✅ | ✅ | ⛔ | ⛔ |
| RSVP insert/delete | ⛔ C-59 | ⛔ C-58 | ✅ ⚠ I-8 C-60 | ✅ own until end; ended ⛔ C-56 | ⛔ C-55/57 | own | own | own | ⛔ |
| Read RSVPs | ⛔ | own | own | own | ⛔ C-54 | ✅ all | ✅ | own | ⛔ |
| Push devices: read/update/delete | ⛔ | ⛔ save C-74 | own | own | ⛔ C-69/70/73; `p_replaces` other's endpoint ⛔ F-79 | own | own | own | ⛔ |
| Push: insert directly / move `user_id` | ⛔ | ⛔ | ⛔ | ⛔ C-71/72 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Push: endpoint not a push service | — | — | — | ⛔ F-75–78 | — | — | — | — | — |
| Read game servers | ⛔ C-84 | ⛔ | checked in + live ✅ | checked in + live ✅ C-81; not checked in ⛔ C-82; upcoming ⛔ C-83 | ⛔ | ✅ | ✅ | only as a member | ⛔ |
| Write/reorder game servers | ⛔ | ⛔ | ⛔ | ⛔ C-85–87 | ⛔ | ✅ (roblox.com https only F-90–94) | ✅ | ⛔ | ⛔ |
| `my_checkin_order` | ⛔ D-192 | null | number if checked in | number C-88 | null C-89 | number | number | — | ⛔ |
| Announcements / site content / About: write, `save_*` | ⛔ D-200–203 | ⛔ C-131–135 | ⛔ C-117–121 | ⛔ C-103–107 | ⛔ | ✅ | ✅ | ⛔ | ⛔ |
| `site_content_edits` (who edited) | ⛔ | ⛔ C-136 | ⛔ C-122 | ⛔ C-108 | ⛔ | ✅ | ✅ | ⛔ | ⛔ |
| `officer_analytics` | ⛔ D-193 | ⛔ C-124 | ⛔ C-110 | ⛔ C-96 | ⛔ | ✅ C-147 | ✅ | ⛔ C-154 | ⛔ |
| `set_officer` | ⛔ D-195 | ⛔ C-123 | ⛔ C-109 | ⛔ C-95 | ⛔ | ⛔ C-137, ⛔ demote owner C-138 | ✅ C-143/144; ⛔ demote self C-142 | ⛔ | ⛔ |
| `clear_nickname` | ⛔ D-196 | ⛔ | ⛔ | ⛔ C-99 | ⛔ | ✅ | ✅ | ⛔ | ⛔ |
| Storage: list `event-flyers` | ⛔ D-167 | ⛔ | ⛔ | ⛔ D-168/169 | ⛔ | ✅ | ✅ | ⛔ C-155 | ⛔ |
| Storage: upload / upsert / delete / move | ⛔ D-171 | ⛔ | ⛔ | ⛔ D-170–174 | ⛔ | ✅ PNG/JPEG/WebP ≤5 MB; SVG/HTML ⛔ D-177–179; traversal ⛔/normalized D-180/183; size ⛔ D-185 | ✅ | ⛔ | ⛔ |
| Realtime `attendance:<id>` join | ⛔ D-160 | ⛔ D-161 | ⛔ | ⛔ D-160 | ⛔ | ✅ C-149 | ✅ | open channel keeps counts ⚠ I-1 (C-156); rejoin ⛔ C-157 | ⛔ |
| Realtime `game:<id>` join | ⛔ (private) | ⛔ | if checked in | if checked in ✅ D-163; else ⛔ D-162 | ⛔ | ✅ | ✅ | as a member | ⛔ |
| Realtime send on private topic | ⛔ | ⛔ | ⛔ | ⛔ D-164 (ack=error, nobody received) | ⛔ | ⛔ (not needed: triggers send) | ⛔ | ⛔ | ⛔ |
| Server Actions, officer ones (`setOfficer`, `deleteEvent`, `regenerateCode`, `removeAttendance`, `addGameServer`, `saveAnnouncement`, `saveLinks`, `clearNickname`) | ⛔ C-34 (app-local) | ⛔ | ⛔ | ⛔ C-24–33 (app-local) | ⛔ | ✅; `setOfficer` ⛔ C-25/26 | ✅ | ⛔ | ⛔ |
| `"use cache"` functions invoked as Server Actions | **✅ before fix, for anyone holding the ID (L-8; IDs are not served to visitors)** → ⛔ 404 after | ⛔ | ⛔ | ⛔ | — | ⛔ | ⛔ | ⛔ | ⛔ |
| `members.csv`, `attendance.csv`, `backup.zip` | ⛔ 403 C-44 | ⛔ | ⛔ | ⛔ 403 C-43/45/46 | — | ✅ `private, no-store` E-08–10 | ✅ | ⛔ (RLS returns nothing; route answers 403 once `getProfile` sees `is_officer=false`) | ⛔ |

Tokens (T): changed `sub` with original signature → 401; `alg=none` → 401; HS256 with a guessed secret → 401; correctly signed but expired → 401 (B-205–208). After a global sign-out the **access token still works until `exp`** (accepted by the owner; ~60 min) and the **refresh token is refused** (B-209/210).

Former officer (R): with the JWT issued while they were an officer, every database read that needs `is_officer` fails immediately after the owner removes them (role is read from `profiles` on each query, not from the JWT). An already-joined `attendance:<id>` channel kept delivering count messages after removal (1 message observed), and re-joining was refused (I-1).

## 2. Endpoint inventory

### Pages (App Router)
| Path | Auth check (in the page itself) | Notes |
|---|---|---|
| `/`, `/events`, `/events/[id]`, `/about`, `/links`, `/privacy`, `/install`, `/join` | none (public) | Event data via `"use cache"` + anon client; `/events/[id]` streams RSVP/check-in buttons |
| `/login` | `getUser` → redirect `safeNext(next)` | `next` sanitized (E-56–73) |
| `/welcome` | `getUser`/`getProfile` | |
| `/join/done` | `requireMember`, `noindex` | |
| `/checkin` | `requireMember`; `?code=` auto-submits (I-5) | |
| `/profile` | `requireMember` | |
| `/play` | `getProfile` | Game links fetched in the browser through RLS |
| `/officer`, `/officer/events`, `/officer/events/new`, `/officer/events/[id]`, `/officer/members`, `/officer/analytics`, `/officer/announcement`, `/officer/content`, `/officer/flyer` | `getOfficer` (redirect / "officers only"); layout `noindex` | All data also behind RLS |
| `/officer/events/[id]/present` | `getOfficer` | Projector; live count over Realtime |

### Route handlers (11)
| Route | Method | Auth | Validation | Rate limit | Returns | Cache |
|---|---|---|---|---|---|---|
| `/auth/callback` | GET | — | `safeNext`, `isUmichEmail` (signs out non-umich) | Supabase Auth | redirect | default |
| `/auth/signout` | POST | session | Origin check **added on branch (I-3)** | — | 303 → `/` | — |
| `/auth/test-sign-in` | GET | E2E builds only (`route.e2e.ts`) | `e2eEnabled()` | — | 404 in production (verified) | — |
| `/go/[[...slug]]` | GET | — | `isSitePath` after dot-segment resolution | — | 307 same-site | `no-store` |
| `/events/[id]/calendar.ics` | GET | — | UUID (via `getPublicEvent`); ICS escaping | — | public event | `public, max-age=300` |
| `/officer/members.csv` | GET | `getProfile().is_officer` + RLS | — | — | all members incl. emails | `private, no-store` |
| `/officer/events/[id]/attendance.csv` | GET | same | UUID | — | check-ins + RSVPs incl. emails | `private, no-store` |
| `/officer/backup.zip` | GET | same | — | — | members, events, attendance, RSVPs | `private, no-store` |
| `/api/push/subscription` | POST | `getUser` | Origin = own origin, `Content-Type: application/json`, `parseSubscription` | 10-device cap (DB) | `{ok}` | `no-store` |
| `/api/cron/reminders` | GET | `Bearer CRON_SECRET`, `timingSafeEqual` | — | once per event (`event_reminders_sent`) | counts | `no-store` |
| `/api/keep-alive` | GET | same | — | — | `{ok, at}` | `no-store` |

### Server Actions (24; each calls an auth helper itself — verified by script and by direct calls)
`checkIn` (getUser) · `previewRobloxUser`, `saveProfile` (getUser, `take_roblox_lookup`) · `turnOnNotifications`, `readNotificationSettings`, `changeNotificationSettings`, `turnOffNotifications` (getUser) · `saveEvent`, `deleteEvent`, `setCheckinOpen`, `regenerateCode`, `removeAttendance`, `setOfficer`, `clearNickname`, `addGameServer`, `updateGameServer`, `setGameServerFull`, `moveGameServer`, `removeGameServer`, `saveAnnouncement` (requireOfficerAction) · `saveLinks`, `saveJoinContent`, `saveFeatured`, `saveAbout` (requireOfficer). Next refuses a cross-site `Origin` (E-35, E-36). No rate limits except the DB ones (check-in, Roblox lookups, devices).

Also reachable through the same mechanism before the fix: **10 `"use cache"` functions** (`events.ts` ×2, `announcements.ts` ×1, `site-content-data.ts` ×4, `roblox.ts` ×3) — L-8.

### RPCs in `public` (PostgREST `/rest/v1/rpc/*`)
| Function | Security | Callers (EXECUTE) | Caller check | Returns |
|---|---|---|---|---|
| `check_in(text)` | DEFINER | authenticated | uid, `is_umich`, profile, per-member lock, 10 wrong/10 min | status + public event fields |
| `set_checkin_open(uuid,bool)` | INVOKER | authenticated | RLS on events (officer) | bool |
| `regenerate_event_code(uuid)` | DEFINER | authenticated | `is_officer` first | code |
| `set_officer(uuid,bool)` | DEFINER | authenticated | `is_owner` first; owner/last-officer rules; advisory lock | void |
| `clear_nickname(uuid)` | DEFINER | authenticated | `is_officer` first | void |
| `public_past_event_counts()` | DEFINER | anon, authenticated | none (public aggregate) | per ended event count, **including <10 (L-3)** |
| `officer_analytics(ts,ts)` | DEFINER | authenticated | `is_officer` | aggregates |
| `save_community_links`, `save_join_content`, `save_featured_panel`, `save_about_page` | INVOKER | authenticated | `is_officer` + RLS + version lock | timestamp |
| `reorder_game_servers(uuid,uuid[])` | INVOKER | authenticated | `is_officer` + RLS | void |
| `my_checkin_order(uuid)` | DEFINER | authenticated | `can_read_game_link` | int or null |
| `save_push_subscription(...)` | DEFINER | authenticated | uid + `is_umich`; per-member lock; cap 10 | void |
| `take_roblox_lookup()` | DEFINER | authenticated | uid + `is_umich`; 20/min | bool |
| `checkin_is_open(events)` | INVOKER (computed column) | anon, authenticated | — | bool |
| `hook_umich_only(jsonb)` | INVOKER | `supabase_auth_admin` only | — | hook result (D-188/189: anon/member ⛔) |

All DEFINER functions: `set search_path = ''`, no dynamic SQL, schema-qualified names (reviewed in every migration). Private helpers (`private.is_umich/is_officer/is_owner/is_checked_in/can_read_game_link/check_content_version/...`) are not reachable through the API (D-186/187: `PGRST106`).

### Tables and views (`public`), RLS on all
`profiles`, `events`, `event_codes`, `attendance`, `event_rsvps`, `event_game_servers`, `announcements`, `community_links`, `join_faq`, `join_what_we_do`, `featured_panel`, `site_content_edits`, `about_story`, `about_timeline`, `push_subscriptions`, `event_reminders_sent` (no grants) and the view `member_attendance` (`security_invoker = true`). `private`: `checkin_failures`, `roblox_lookups` (no grants). Policy-by-policy review is in 06 (D-section) and in `supabase/tests/security_test.sql`.

### Realtime
`attendance:<event uuid>` (private; SELECT policy: officers; payload `{count}`), `game:<event uuid>` (private; SELECT: officers or checked-in members; payload `{}`). No INSERT policy: client sends refused. Public channels with the same names are joinable by anyone but carry nothing the app sends (I-11).

### Storage
Bucket `event-flyers`: public read; `allowed_mime_types` PNG/JPEG/WebP; 5 MB; INSERT/UPDATE officer + name regex; DELETE/SELECT officer. Object keys are normalized by Storage before the policy check (`covers/../x.png` → `x.png`).

### Crons (vercel.json)
`/api/keep-alive` daily 15:00 UTC; `/api/cron/reminders` daily 14:00 UTC. Both need `CRON_SECRET`; both safe to run twice (F-51).

## 3. Third-party services
Supabase (DB, Auth, Realtime, Storage), Vercel (hosting, CDN, image optimization, Web Analytics, crons), Google (OAuth, Calendar, Forms/Sheets), Roblox (users, thumbnails, CDN), push services (FCM, Mozilla, Apple, Windows), GitHub (code, Actions), npm registry.

## 4. Production checks (signed-out GETs only)
- `/auth/v1/settings`: only Google enabled; email, phone, anonymous off; `disable_signup: false`.
- Data API as anon: 401 for `profiles`, `member_attendance`, `attendance`, `event_codes`, `event_rsvps`, `push_subscriptions`, `event_game_servers`, `site_content_edits`, `event_reminders_sent`, `events.created_by`, `announcements.created_by`; dropped tables gone (404); `public_past_event_counts` → `[]`.
- Site: headers (CSP, HSTS 2 years + includeSubDomains, X-Frame-Options DENY, nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy) on every route checked; `/auth/test-sign-in` 404; `/officer/*.csv|zip` 403; crons 401; `/go` and `/auth/callback` redirects stay on site; no robots.txt/sitemap.
- Side effect to know about: six `/auth/v1/authorize?provider=google` GETs (not followed) were sent to see how redirect URLs are handled; like any "Sign in" click, each probably created a short-lived OAuth flow record in Supabase Auth. No other production state was touched.
