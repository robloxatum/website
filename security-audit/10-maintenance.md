# 10 — Maintenance

## 1. Routine

| When | Task | How |
|---|---|---|
| Every change | Tests | `npm test`, `npm run test:db`, `npm run test:e2e` (all local) |
| Every change touching the DB | Migration order | Show the migration → apply it to production (below) → **then** merge/push `main` (production DB first, the memory rule). The CLI is **unlinked** (L-5), so everything else runs against the local stack |
| Never | `supabase config push` | **Never run it.** `supabase/config.toml` is for the local stack: it turns email/password sign-in on (with no email confirmation) for the end-to-end tests. Pushed to production, anyone could register any @umich.edu address without owning the mailbox. Change production auth settings in the Supabase dashboard only. CI (`scripts/check-prod-auth.mjs`) fails if production ever allows email, phone or anonymous sign-in |
| Applying a migration to production | Link only for the push | `npx supabase link --project-ref <ref>` → `npx supabase db push --remote --dry-run` (check the list) → `npx supabase db push --remote` (CLI v3 defaults to the local stack without `--remote`, and asks for confirmation) → `npx supabase unlink` |
| Weekly (during term) | Download a backup | Officer dashboard → **Download full backup** (`backup.zip`) → store it in a folder only officers can open; delete copies older than ~2 months |
| Weekly | Glance at usage | Vercel → Usage (Image Optimization, Functions); Supabase → Usage (egress, DB size) |
| After each event | Rotate what was shown | Regenerate the event's check-in code if it might be reused; **regenerate the private Roblox server links** in Roblox (I-7) |
| Monthly | Dependencies | `npm audit`, `osv-scanner scan --lockfile package-lock.json`, `npm outdated`; update Next/React/Supabase patch releases promptly (read `node_modules/next/dist/docs` per AGENTS.md) |
| Monthly | Secrets in git | `gitleaks git --redact .` (history) |
| Monthly | Supabase Security Advisor | expect the 11 accepted warnings only |
| Each semester | Access review | 08 §0, S-13, V-1, G-1, H-1, D-1, P-1: remove graduated/ex-officers everywhere (site officers list, Supabase team, Vercel, GitHub, Gmail password, Discord roles, GroupMe admins, Google Sheet sharing) |
| Each semester | Data retention | delete members who asked; consider deleting accounts inactive for 2+ years (Supabase → Authentication → Users); purge old Form responses |
| Yearly | Rotate `CRON_SECRET` | 09 §1 (it's never been rotated: accepted, but cheap to do) |
| Yearly / officer handover | Re-read 08 and this file with the new owner | transfer ownership of each account |

## 2. Audit scripts (local only; they refuse non-local Supabase)
Run after `npm run test:e2e` (it builds `.next-e2e`):
```sh
node security-audit/attacks/persona-matrix.mjs     # 212 checks, direct API/RPC/Realtime/Storage
node security-audit/attacks/app-local.mjs          # 91 checks, the Next.js app
node security-audit/attacks/use-cache-actions.mjs  # L-8 stays fixed (exit 0)
node security-audit/attacks/realtime-spoof.mjs
node security-audit/attacks/restore-drill.mjs      # the backup still restores
```
Each writes JSON to `security-audit/evidence/`. Re-run them after a Next.js major/minor upgrade, after any migration touching RLS or grants, and after adding a page, action or route.

## 3. Things not covered by backup.zip (keep copies)
- Links, Join, Featured, About text: copy from the officer content pages into a doc each semester.
- Flyer and cover images: keep the originals where you made them.
- Game server links (they're per event anyway), announcements, push devices (members re-subscribe).

## 4. Restore from backup.zip (tested 2026-11-27 locally, `restore-drill.mjs`)
1. New or recovered Supabase project: `npx supabase link --project-ref <new>` → `npx supabase db push` (all migrations) → set the hook (08 S-1), Google provider, redirect URLs, keys; update Vercel env → redeploy → `npx supabase unlink`.
2. Members sign in again with Google. That creates **new** account IDs; the IDs in the zip won't match. Alternatively, pre-create accounts by email in Authentication → Users. (Whether Google sign-in then links to a pre-created user wasn't tested, since it needs real Google.)
3. Import with a one-off script modelled on `restore-drill.mjs` step 4:
   - Events with their original IDs (`events.csv`).
   - Profile fields matched **by uniqname** (`members.csv`).
   - Check-ins and RSVPs, user IDs looked up by uniqname.
   - Strip the export's formula guard: a leading `'` before `= + - @`. One rare ambiguity: a value that truly started with `'-` loses its quote.
4. Check counts against the zip's `README.txt`.

## 5. Done from this audit (2026-11-27)
- L-3: counts-threshold migration applied to production; signed-out result unchanged (`[]`).
- M-1: avatars `unoptimized`, `rbxcdn` image pattern removed.
- L-1: flyer/cover metadata stripped on upload (`src/lib/strip-metadata.ts`).
- L-2: privacy page text (no purge function yet).
- L-5 (part): CLI unlinked; `security_test.sql` header says `--local`.
- L-6: `permissions: contents: read`, actions pinned to commit SHAs.
- L-8, I-3, I-10 (`robots.ts`).

## 6. To do over winter break
- [ ] **L-4 audit log**: `private.audit_log (at, actor, action, target)`, written by `set_officer`, a `log_export()` RPC called by the three export routes, and a trigger on attendance delete. Officers can read it; nobody can update or delete rows. Migration to be shown first; DB tests: exporting writes a row, a member can't read or write the log, an officer can't delete rows.
- [ ] **L-7 reminders past 1000 devices**: page through `push_subscriptions` in `/api/cron/reminders` (`.range()` in steps of 1000) instead of one select; unit/e2e test with more than 1000 rows locally.
- [ ] **Daily purge (L-2 follow-up)**: a SECURITY DEFINER `private.purge_old_rate_limits()` that deletes `checkin_failures` older than a day and `roblox_lookups` older than a minute, called by the keep-alive cron. Migration shown first. Then change the privacy page back to "deleted after a day" (and update `tests/privacy-page.test.mjs`).
- [ ] **L-5, the rest**: point `.env.local` at the local Supabase for `next dev`; keep production values only in Vercel (or a separate `.env.production.local` used on purpose); update the memory note that localhost and Vercel share the production database.
- [x] Privacy page: response time for deletion requests (03 §5 item 7): no fixed time is promised ("We'll reply as soon as we can."). Retention is "while the club needs them for its records", with deletion on request.
- [ ] **RSVP rate limit** (found 2026-11-27): RSVPs are written straight from the browser to `event_rsvps` with no limit. Add a BEFORE INSERT OR DELETE trigger with a per-member advisory lock that logs changes in a private table and refuses with `rate_limited` past ~20 changes per 10 minutes; show "Too many changes. Try again in a few minutes." in `RsvpToggle.tsx`. Migration shown first; DB test (21st change refused, other members unaffected) and e2e.
- [ ] **Google `hd` check** (optional hardening, found 2026-11-27): the hook and `is_umich()` trust the email suffix. Also require Google's hosted-domain claim (`hd = umich.edu`, in the user's provider metadata) in `public.hook_umich_only`, so only U-M Google Workspace accounts get in, not a personal Google account registered with a umich address. Check what the hook's `event.user` actually contains first; migration shown first; DB test.
- [ ] Dashboard items in 08 not done before launch.
