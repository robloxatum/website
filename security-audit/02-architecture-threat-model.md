# 02 — Architecture, data flows, trust boundaries, STRIDE

Audit 3, branch `security-audit-3` off `main` @ 299f8d7. Everything below comes from reading the code at that commit and from tests run on the local stack, plus signed-out GETs against production. Items marked **(dashboard)** can't be seen from the repo; see 08-owner-dashboard-checklist.md.

## 1. Components

| Component | What runs there | Credentials it holds |
|---|---|---|
| Browser (member, officer, visitor) | React client components, Supabase JS client (lazy-loaded), service worker `public/sw.js`, Vercel Web Analytics script | Supabase auth cookies (`sb-<ref>-auth-token[.N]`, JS-readable, SameSite=Lax, Secure in production builds), PKCE verifier cookie during sign-in, localStorage keys for a dismissed announcement and the install bar |
| Vercel functions (Next.js 16.4.6, App Router, `cacheComponents` + Partial Prerendering) | Server Components, 24 Server Actions, 11 route handlers, `proxy.ts`, 2 crons | Publishable key (public). Production only: `CRON_SECRET`, `VAPID_PRIVATE_KEY`, `SUPABASE_SECRET_KEY` (read only by `src/lib/push/send.ts` via `src/lib/supabase/admin.ts`) **(dashboard: scoping)** |
| Vercel CDN / data cache | Prerendered PPR shells; `"use cache"` results (events, announcement, site content, Roblox lookups); `/_next/image` transformations | none |
| Supabase Postgres (project ref visible in `.env.example`; free plan) | `public` schema (exposed through PostgREST), `private` schema (not exposed: PostgREST answers 406 `PGRST106`), RLS on every table, 21 migrations | n/a |
| Supabase Auth (GoTrue) | Google OAuth only in production (`/auth/v1/settings`: `google: true`, `email: false`, `phone: false`, `anonymous_users: false`), before-user-created hook `public.hook_umich_only` **(dashboard: hook enabled)** | Google OAuth client secret **(dashboard)** |
| Supabase Realtime | Private broadcast topics `attendance:<event>` (officers) and `game:<event>` (officers + checked-in members); payloads `{count}` and `{}` | n/a |
| Supabase Storage | Public bucket `event-flyers` (PNG/JPEG/WebP, 5 MB), objects `<uuid>.png|jpg` and `covers/<uuid>.png|jpg|webp`, officer-only writes/list | n/a |
| Google | OAuth (consent screen, `hd=umich.edu` hint only), the public club Calendar, the "Get event updates" Google Form + Sheet (outside the app) | club Google account **(dashboard)** |
| Roblox | `users.roblox.com` (username → ID), `thumbnails.roblox.com` (ID → CDN URL), `*.rbxcdn.com` images (loaded by browsers and by `/_next/image`) | none |
| Push services | FCM, Mozilla, Apple, Windows (`*.notify.windows.com`); only these hosts are accepted (app + DB check) | VAPID private key signs requests |
| GitHub Actions | `.github/workflows/e2e.yml`: on push, unit + local-Supabase e2e; no secrets used | default `GITHUB_TOKEN` (permissions not declared in the workflow) |

## 2. Data flows (personal data in **bold**)

1. **Sign-in**: browser → Supabase `/auth/v1/authorize?provider=google` (PKCE) → Google → Supabase callback → hook refuses non-`@umich.edu` → `auth.users` insert fires `private.handle_new_user()` → `public.profiles` (**uniqname** = email local part, **full_name** from Google) → redirect to `/auth/callback?code=…&next=…` → `exchangeCodeForSession` sets cookies → `/welcome` or `safeNext(next)`.
2. **Profile**: Server Action `saveProfile` → `take_roblox_lookup()` (20/min) → Roblox users API (**Roblox username** leaves our server) → `profiles` update (**nickname**, **roblox_username**, **roblox_user_id**) under RLS.
3. **Check-in**: QR `/checkin?code=XXXXX` (auto-submits) or typed code → Server Action `checkIn` → `public.check_in()` (SECURITY DEFINER; per-member advisory lock; 10 wrong codes / 10 min) → `attendance` (**who, which event, when**) and `private.checkin_failures` (**time of each wrong code**) → trigger broadcasts `{count}` on `attendance:<event>`.
4. **RSVP**: browser → PostgREST `event_rsvps` insert/delete under RLS (**who plans to attend**).
5. **Game servers**: officer → Server Actions → `event_game_servers` (private Roblox links) → trigger broadcasts `{}` on `game:<event>` → checked-in members re-read through RLS while the event is live.
6. **Push**: browser subscribes → Server Action / `/api/push/subscription` → `save_push_subscription()` (**endpoint URL + keys per device**, cap 10) → crons/actions read all devices with the secret key → push services.
7. **Officer views and exports**: officer pages, `members.csv`, `attendance.csv`, `backup.zip` read **all profiles, emails (uniqname@umich.edu), attendance, RSVPs** as the officer (RLS) → downloaded to officers' laptops (outside our control).
8. **Analytics**: `officer_analytics()` aggregates; Vercel Web Analytics receives page paths with query strings removed (`redactForAnalytics`), `/join?src=x` folded into the path.
9. **Avatars**: browsers load `*.rbxcdn.com` images directly (exposes the viewer's IP to Roblox's CDN) or through `/_next/image`.

## 3. Trust boundaries

| # | Boundary | What crosses it | Main controls (verified) |
|---|---|---|---|
| TB1 | Internet → Vercel | Page requests, Server Action POSTs, route handler calls, `/_next/image` | Server Actions re-check the user (24/24, `security-audit/attacks/app-local.mjs`); Next's Origin check on actions (cross-site Origin → refused); CSP/headers on every route; **gap: `"use cache"` functions were callable as actions (L-8, fixed on branch)** |
| TB2 | Internet → Supabase Data API | Direct PostgREST/RPC calls with the public key + user JWT | RLS + column grants + function grants; 212-check persona matrix passed (`persona-matrix.mjs`); production anon denials confirmed by GET |
| TB3 | Internet → Realtime | WebSocket joins of private topics, sends | `realtime.messages` SELECT policies; no INSERT policy (sends refused, `realtime-spoof.mjs`); authorization at join time only |
| TB4 | Internet → Storage | Public reads, officer writes | Bucket MIME + size limits; officer-only INSERT/UPDATE/DELETE/SELECT policies; names validated by regex |
| TB5 | Vercel → Supabase (secret key) | Push sender reads every device, deletes dead ones | Secret key used in exactly one module (grep + custom semgrep rule); push hosts allow-listed in app and DB |
| TB6 | Supabase Auth ↔ Google | OAuth code, ID token, email, name | Google-only provider; hook `hook_umich_only`; PKCE; **redirect allowlist (dashboard)** |
| TB7 | Vercel → Roblox | Usernames, user IDs | Timeouts, CDN-URL check on responses; limit 20/min/member — **was bypassable via L-8** |
| TB8 | Vercel → push services | Encrypted payloads (event title/time; never game links) | VAPID; host allow-list; `redirect: "error"` |
| TB9 | Officer laptop ↔ exports | Full member list, attendance | `Cache-Control: private, no-store`; formula-injection escaping; **no audit trail (L-4)** |
| TB10 | Developer laptop ↔ production | `.env.local` → production DB; Supabase CLI **linked to the production project** | E2E script refuses non-local URLs; `--local` flags. Risk noted in H/J (L-5) |

## 4. STRIDE

Each threat lists the control that stops it and the evidence, or the finding ID if something is open.

### Spoofing
| Threat | Status | Evidence |
|---|---|---|
| Non-umich Google account signs in | Blocked by the hook; `isUmichEmail` in `/auth/callback` also signs out non-umich; RLS helpers require `@umich.edu` in the JWT | B-01–B-05 (public sign-up path refused, including `umich.edu.evil.com`, `sub.umich.edu`, `xumich.edu`); C-62 (non-umich session gets `not_umich`) |
| Email+password sign-up as someone else's `@umich.edu` | Not possible in production: email provider off | `/auth/v1/settings` (production GET) |
| Forged/tampered/expired JWT | Refused | B-205–B-208: changed `sub` with original signature, `alg=none`, guessed HS256 secret, expired → 401 |
| OAuth login CSRF / code injection | PKCE: verifier cookie on the victim's browser | code review of `@supabase/ssr` flow; callback only exchanges codes |
| Wildcard redirect URL lets another `*.vercel.app` site receive codes | **Unverified (dashboard)**; would be High if present | 08 checklist item S-3 |
| Impersonating an officer by nickname (Unicode tricks) | Nickname regex blocks zero-width, RTL override, Cyrillic look-alikes, HTML | E-37–E-41. `full_name` (from Google) has no character rule, shown only to officers (I-6) |

### Tampering
| Threat | Status | Evidence |
|---|---|---|
| Member edits role/uniqname/id/created_at | Column grants refuse | C-28–C-32 |
| Member writes attendance directly or for others | No INSERT grant; `check_in()` has no user parameter | C-45, C-46 |
| Officer promotes someone / demotes the owner / makes self owner | `set_officer` owner-only; trigger keeps last owner; no grant on `is_owner` | C-137–C-142 |
| Unsafe links stored (game servers, announcements, featured panel, community links) | DB CHECK regexes + app normalizers | F-90–F-94; existing `security_test.sql` sections |
| Spoofed Realtime "changed"/count messages | No INSERT policy; send refused | D-164, `realtime-spoof.mjs` |
| Storage overwrite/delete of officer files by members | RLS | D-170–D-174 |

### Repudiation
| Threat | Status |
|---|---|
| Officer exports member data, changes roles, removes check-ins: no record of who did it | **Open (L-4)**. Only `site_content_edits`, `events.created_by`, `event_game_servers.updated_by` exist, and officers can write the latter two freely through the API (I-9). Vercel Hobby runtime logs are short-lived. |

### Information disclosure
| Threat | Status | Evidence |
|---|---|---|
| Visitor/member lists, counts or searches the member list | Refused through tables, views, counts (`Prefer: count=exact`), RPC errors (role checked before existence) | C-12–C-26, D-145/146; production GETs |
| Event codes to members | RLS | C-49–C-52 |
| Game links to members not checked in / before start / after end | RLS (`can_read_game_link`) | C-81–C-84 |
| Private data in HTML/RSC to the wrong persona | None found | E-11–E-20 (other member's uniqname/nickname, codes, game URLs, officer uniqname, `is_officer`) |
| Private pages cached by shared caches | Local build: `private, no-cache, no-store` on every signed-in page; exports `private, no-store`. On Vercel the PPR shell is `public, max-age=0, must-revalidate`; the signed-in streamed response header is **unverified (I-2)** | E-02–E-10 |
| Attendance counts below 10 | **Open (L-3)**: `public_past_event_counts()` returns them to anyone; only the UI hides them | F-189 |
| Location metadata in uploaded photos | **Open (L-1)**: EXIF/GPS kept byte for byte on the public URL | `exif-check.mjs` |
| Secrets in git, build output, client bundle | None | gitleaks (history all refs: 0; tree: 26 hits, all in ignored local files); bundle grep; no source maps |

### Denial of service / resource exhaustion
| Threat | Status |
|---|---|
| Roblox API amplification through our server by anyone holding a `"use cache"` function ID (IDs are per build and not shown to visitors) | **Fixed on branch (L-8, Low)** |
| Image-optimizer quota burn with arbitrary `*.rbxcdn.com` URLs; Supabase egress on 5 MB public flyers | **Open (M-1)** |
| Code guessing bursts | Per-member lock, 10/10 min (F-64) |
| Device flooding | 10-device cap under parallel saves (F-80) |
| Realtime connection exhaustion (free plan concurrent limit) with the public key | Possible; app falls back to polling (I-11) |

### Elevation of privilege
| Threat | Status |
|---|---|
| Member → officer, officer → owner, removed officer keeps rights | Refused; removed officer loses DB access on the next request with the same JWT (C-152–C-155); an already-open Realtime channel keeps getting counts until it rejoins (I-1) |
| Calling `private` functions or the auth hook | Schema not exposed; hook EXECUTE revoked (D-186–D-189) |
| Test sign-in in a production/preview build | Not compiled (`pageExtensions` only in E2E builds), refuses unless local DB + `E2E_TEST_AUTH=1` + not Vercel, `next.config.ts` throws otherwise; production `/auth/test-sign-in` → 404; `e2e/prod-build.check.mjs` passed |
