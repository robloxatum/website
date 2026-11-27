# 09 — Incident response

Short and practical for a one-owner club site. Keep a printed or offline copy: if the club Gmail is the thing that's compromised, you won't be able to read this there.

## 0. First 15 minutes (any incident)
1. **Don't delete evidence.** Take screenshots and note times (with timezone).
2. **Write a log**: a plain text file on your own laptop: time, what you saw, what you did.
3. **Contain** with the matching playbook below. Prefer reversible switches (rotate a key, remove a role) over deleting data.
4. Tell one other trusted officer that you're handling it.

## 1. Quick switches (where, and what they break)

| Switch | Where | Effect | Undo |
|---|---|---|---|
| Take the site offline | Vercel → Project → Settings → **Deployment Protection** → protect Production (or **Pause** the project, if your plan shows it) | Site unavailable | Turn back off |
| Roll back a bad deploy | Vercel → **Deployments** → pick the last good one → **⋯ → Promote to Production** (Instant Rollback) | Old code live | Promote the newer one |
| Stop all sign-ins | Supabase → Authentication → Providers → **Google off** | Nobody can sign in; existing sessions last ≤1 h | Turn back on |
| Sign everyone out | Supabase SQL editor: `delete from auth.sessions;` (its refresh tokens go with it) (or per user: Authentication → Users → user → **Sign out**). Access tokens expire within 1 hour | Members sign in again | — |
| Remove an officer | Site: Officer → Members → remove officer (owner only); emergency: SQL `update public.profiles set is_officer = false where uniqname = '<uniqname>';` | Effective on their next request | Re-add |
| Rotate the Supabase secret key (push) | Supabase → Project Settings → **API Keys** → create a new secret key → put it in Vercel `SUPABASE_SECRET_KEY` (Production) → redeploy → **delete** the old key | Push sending pauses until redeploy | — |
| Rotate `CRON_SECRET` | Vercel env → new random value → redeploy | Crons use the new value automatically | — |
| Rotate VAPID keys | `npx web-push generate-vapid-keys` → update both env vars → redeploy | **All devices must turn notifications on again** (old subscriptions fail) | — |
| Turn off push sending | Remove `VAPID_PRIVATE_KEY` from Vercel → redeploy | No notifications | Add back |
| Close check-in on an event | Officer → event → Check-in **off**; **Regenerate code** | Old QR/code stop working | Turn on |
| Remove a flyer | Officer → event → remove image; or Supabase Storage → `event-flyers` → delete object | Public URL stops working (CDN may cache for a while) | Upload again |

## 2. Playbooks

### A. A secret leaked (key in a commit, screenshot, chat)
1. Identify which: `SUPABASE_SECRET_KEY` (critical: full database access), `VAPID_PRIVATE_KEY` (can send notifications to subscribed devices), `CRON_SECRET` (can trigger reminders and keep-alive only), Google OAuth client secret, DB password.
2. Rotate it now (table above; for Google: Cloud Console → Clients → reset secret → paste into Supabase).
3. For the Supabase secret key: check Supabase → **Logs** (API / Postgres) for unusual requests with the service role since the leak; check `auth.users` and `profiles.is_officer` for surprises (`select uniqname, is_officer, is_owner from public.profiles where is_officer;`).
4. If it was committed: rotating is the fix. Rewriting git history is optional and doesn't un-leak it.
5. Run `gitleaks detect` on the repo to make sure there's nothing else.

### B. Someone who shouldn't be is an officer, or an officer account is compromised
1. Remove the officer flag (switch above). If it's the **owner** account, sign in to Supabase and use SQL.
2. Sign that user out: Authentication → Users → the user → sign out / delete their sessions.
3. Look at what they could have touched: events (`select title, updated_at from events order by updated_at desc limit 20;`), announcements, Links/Join/About content (`site_content_edits`), game links, check-ins removed (no log, L-4), **exports downloaded** (no log, L-4: assume yes).
4. Restore content from the last good backup or by hand; regenerate event codes; replace game server links (I-7).
5. If exports were likely taken, go to D.

### C. Defacement or a malicious link on the site
1. Edit or delete it from the officer pages (announcement, Links, Featured, About, event text, game link).
2. If you can't sign in: Supabase Table Editor → the row → fix it.
3. Find out how (B, or a code change → check GitHub commits and Vercel deployments).

### D. Member data exposed (export shared, account compromise, bug)
1. Contain it: remove the file from wherever it was shared; ask recipients to delete it; fix the bug or roll back.
2. Work out **what** (which columns: names, uniqnames/emails, attendance, RSVPs, Roblox usernames), **whose** (count), and **when**.
3. Tell affected members **within a few days**, in plain words: what happened, what data, what you did, what they can do. Use the club email; BCC members.
4. Tell your faculty/staff advisor and, if U-M systems or University data are involved, U-M's IT security office (Information Assurance, through the ITS Service Center). Ask the advisor whether anything else is required for a student organization.
5. Michigan's breach-notice law likely doesn't apply to name + email + attendance (03 §6), but tell members anyway.

### E. Abuse or cost spike (bot traffic, image quota, Roblox blocking us)
1. Vercel → Usage: which metric? Image Optimization → apply the M-1 fix (avatars `unoptimized`). Functions → check Logs for the path.
2. Vercel → Settings → **Firewall**: add a rule blocking the abusive IP or country, or turn on **Attack Challenge Mode** temporarily.
3. Roblox lookups failing for everyone: that's L-8's scenario (fixed on the branch). Wait it out; failures are cached for a minute.

### F. Supabase project paused, broken or lost
1. Paused: Supabase dashboard → **Restore project** (free projects pause after inactivity). Check why keep-alive didn't run (Vercel → Cron Jobs).
2. Lost or corrupted data: restore from the newest officer **backup.zip** using the procedure in 10 §4 (tested in the restore drill: members, events, check-ins and RSVPs come back; accounts get new IDs and are re-linked by uniqname).
3. What the zip doesn't have: event codes (regenerated), game links, announcements, Links/Join/Featured/About content, push devices, flyer images. Keep copies of the content text somewhere (10 §3).

### G. Club Gmail or GitHub account taken over
1. Use Google/GitHub account recovery with your backup codes.
2. From another device: check Gmail forwarding and filters, GitHub collaborators, deploy keys, Actions secrets, and recent commits.
3. If GitHub was taken: check Vercel Deployments for unexpected deploys → Instant Rollback; then rotate every Vercel env secret (the attacker could have added code that printed them).

## 3. After any incident
- Write 5 lines: what happened, how you found out, what you did, what changes now, the date.
- Add a test or checklist item so it can't recur silently.
- Update 10-maintenance.md if a routine was missing.
