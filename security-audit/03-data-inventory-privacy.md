# 03 — Data inventory and privacy

Built from the migrations (columns listed from the local DB, which runs the same 21 migrations), the code, and the privacy page at `src/app/(main)/privacy/page.tsx`. "Who can see" was **tested** (04 matrix), not just read from policies. I'm not a lawyer: section 6 is a checklist of questions for the owner, not legal advice.

## 1. What we store

| Data | Where (table.column) | Source | Who can read it | Kept until | Deleted with the account? |
|---|---|---|---|---|---|
| U-M email | `auth.users.email` (Supabase Auth); repeated in exports as `uniqname@umich.edu` | Google sign-in | Supabase project admins; officers see it as uniqname | account deletion | yes |
| uniqname | `profiles.uniqname` | email local part | the member, officers | account deletion | yes (cascade) |
| Full name | `profiles.full_name`; `auth.users.raw_user_meta_data` | Google | the member, officers | account deletion | yes |
| Google profile extras (avatar URL, provider ID, `hd`, `email_verified`) | `auth.users.raw_user_meta_data`, `auth.identities` | Google | Supabase admins only (not exposed by the app) | account deletion | yes |
| Nickname | `profiles.nickname` | member | the member, officers (no public page reads `profiles`: checked by grep of every non-officer route, and the E-section payload tests found no other member's nickname) | member clears it / deletion | yes |
| Roblox username + user ID | `profiles.roblox_username`, `.roblox_user_id` | member (ID looked up from Roblox) | the member, officers | member clears it / deletion | yes |
| Officer / owner flag | `profiles.is_officer`, `.is_owner` | owner | the member (own), officers | change / deletion | yes |
| Onboarded / joined times | `profiles.onboarded_at`, `.created_at` | app | the member, officers | deletion | yes |
| Check-ins (who, which event, when) | `public.attendance` | `check_in()` | the member (own), officers; **public: count per ended event** (L-3) | deletion of member or event | yes (cascade) |
| RSVPs | `public.event_rsvps` | member | the member (own), officers | undo before end / deletion | yes |
| Wrong check-in code times | `private.checkin_failures (user_id, attempted_at)` | `check_in()` | nobody through the API | rows > 1 day deleted **only on that member's next check-in** (L-2) | yes (cascade from `auth.users`) |
| Roblox lookup times | `private.roblox_lookups (user_id, looked_up_at)` | `take_roblox_lookup()` | nobody through the API | rows > 1 min deleted on that member's next lookup (L-2: not on the privacy page) | yes |
| Push devices | `push_subscriptions (endpoint, p256dh, auth, prefs, times)` | member's browser | the member (own); the push sender (secret key) | member turns off / device gone (410) / deletion; max 10 | yes |
| Who last edited site sections | `site_content_edits.updated_by` | officer | officers | overwritten / set null when the officer is deleted | set null |
| Event author / game-link editor | `events.created_by`, `event_game_servers.updated_by`, `announcements.created_by` | app (officer-writable, I-9) | signed-in users can read `events.created_by` UUIDs; anon can't | set null on deletion | set null |
| Event check-in codes, game server links | `event_codes`, `event_game_servers` | officers | officers; links to checked-in members while live | event deletion | n/a |
| Flyer/cover images | Storage `event-flyers` (public) | officers | **anyone** (public URLs), with EXIF intact (L-1) | officer deletes / replaces | n/a |
| Browser storage | auth cookies `sb-<ref>-auth-token*` (session), PKCE verifier cookie (during sign-in), localStorage: closed announcement ID, install-bar dismissal | app | the device | sign-out / clearing the browser | n/a |
| Service logs | Supabase Auth audit log (sign-ins, IPs), Supabase API/Postgres logs, Vercel runtime/request logs (IPs, paths), Vercel Web Analytics (paths without query, country, device; no cookies) | platforms | project admins | platform retention (Hobby/free: short, see 08) | no (platform-managed) |

**Outside the app** (the privacy page doesn't cover these): the "Get event updates" Google Form and its Sheet (whatever it asks: probably email/name), the public Google Calendar, CSV/ZIP exports on officers' devices, the Discord and GroupMe groups.

## 2. Where it goes (processors)

| Recipient | What | Why |
|---|---|---|
| Supabase (US region; check in dashboard) | everything above | database, auth, storage, realtime |
| Vercel | requests, IPs, page paths, analytics | hosting |
| Google | sign-in (Google already has the account) | OAuth |
| Roblox | Roblox usernames (from our server, at lookup), user IDs (thumbnail requests from our server); **every viewer's IP** when their browser loads an avatar from `*.rbxcdn.com` | avatars |
| Push services (Google FCM, Mozilla, Apple, Microsoft) | encrypted notification (event title/time), device endpoint | notifications |
| GitHub | code only; no member data in the repo (only synthetic test emails and the club Gmail; checked with gitleaks + grep) | source control |

## 3. Data minimization review
- **Fine:** no phone, address, student ID, birthday or grades; no passwords; no payment data; analytics without cookies and with query strings removed; game links never sent in notifications; public pages show only aggregate counts ≥10 (in the UI).
- **Could be smaller:**
  1. `full_name` is copied from Google; the app only shows it to officers. Keep, but say so on the privacy page.
  2. Wrong-code and lookup times outlive their purpose for members who stop checking in (L-2). A daily purge fixes this.
  3. Public counts under 10 are reachable through the RPC (L-3).
  4. Uploaded photos keep GPS (L-1).
  5. Exports include every member's email; `attendance.csv` repeats names per row. Fine for officers, but L-4 (no record of who exported) matters more because of it.

## 4. Member rights in practice (tested where possible)
| Request | How today | Tested |
|---|---|---|
| See my data | profile page shows nickname, Roblox, attendance count/history; no full export for members | partly (UI) |
| Fix my data | nickname, Roblox username on `/profile`; name comes from Google | yes (C-section) |
| Delete my account | email the club; owner deletes the user in Supabase Dashboard → Authentication → Users. All rows cascade (FK list below) | yes: restore drill deleted users and every profile, check-in, RSVP and device row went with them |
| Stop notifications | Profile → turn off; or sign out on that device | yes (e2e push spec) |

Foreign keys (local DB): `profiles.id → auth.users` cascade; `attendance.user_id`, `event_rsvps.user_id`, `push_subscriptions.user_id → profiles` cascade; `private.checkin_failures`, `private.roblox_lookups → auth.users` cascade; `events.created_by`, `announcements.created_by`, `event_game_servers.updated_by`, `site_content_edits.updated_by → profiles` set null. So one dashboard deletion removes everything we hold about a member, except copies in exports, the Google Form/Sheet, and platform logs.

## 5. Privacy page: suggested text changes (L-2) — applied 2026-11-27 except item 7 (response time, owner to decide)
Replace or add (plain words, same style as the page):
1. (Done 2026-11-27, interim wording; purge function on the winter-break list.) "The times of wrong check-in codes, to stop code guessing. We delete them after a day." → only true once a daily purge exists. Until then: "…We keep the last day's worth; older ones are deleted the next time you check in."
2. Add: "When you add or change your Roblox username, we note the time, to limit how often our site asks Roblox. We delete it after a minute."
3. "The only cookie keeps you signed in." → "Our cookies keep you signed in (and one short-lived cookie finishes signing you in). Your browser also remembers, on your device only, announcements you closed and whether you dismissed the 'install' bar."
4. Add a "How long we keep it" paragraph: "We keep your profile and attendance while you're a member. Tell us when you graduate or leave and we'll delete them. Officers delete old exports."
5. Add under "Who we share it with": "To find your Roblox user ID, our server sends your Roblox username to Roblox. Avatar pictures load from Roblox's servers, which see your device's IP address, like any image on the web."
6. Add: "If you filled in our 'Get event updates' Google Form, that answer lives in the club's Google account, not on this site; email us to remove it."
7. Name a contact and a response time for deletion requests (the page already gives the club email).

## 6. Compliance notes (questions for the owner, not legal advice)
- **FERPA:** applies to education records kept by the University or someone acting for it. A student org's own member list is generally not a FERPA record, but **if the club ever gets data from the University** (rosters, M-Compass exports), that data may carry University rules. Today the app gets nothing from the University except Google sign-in for umich accounts.
- **U-M policies:** check U-M's rules for student organizations (data handling, use of the U-M name/logo, use of umich Google sign-in for a third-party app). U-M's Google Workspace may show users a consent screen for unverified apps; the OAuth consent screen should name the club, not the University (08 G-section).
- **Michigan breach notification (Identity Theft Protection Act, MCL 445.72):** it covers "personal information" such as name + SSN, driver's license, or account numbers with access codes. Name + umich email + attendance likely falls outside it, but a leak should still be disclosed to members (09).
- **GDPR:** may apply to members in the EU/EEA during study abroad or international students physically in the EU when they use it; the realistic exposure is low for a US student club. Basics already in place: purpose limitation, deletion on request, minimal data. Missing: a stated retention period (5.4 above) and a contact.
- **COPPA:** only applies to under-13 users; umich accounts are students/staff. Not applicable in practice, as long as sign-in stays umich-only.
- **Roblox Terms:** using the public users/thumbnails APIs from a server at low volume is normal; L-8's fix keeps the volume bounded.
