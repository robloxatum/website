# Roblox at UM website

Events and meeting check-in for Roblox at the University of Michigan.
Next.js 16 (App Router, Cache Components) + Supabase (Postgres, Google auth, Realtime), deployed on Vercel.

## What's where

| Path | What |
|---|---|
| `src/app/(site)/` | Public pages, sign-in, `/checkin`, `/profile`, officer pages |
| `src/app/(present)/officer/events/[id]/present` | Full-screen QR / code / live count |
| `src/app/auth/callback` | Google OAuth callback (re-checks umich.edu) |
| `src/lib/` | Supabase clients, auth helpers, time formatting, links config |
| `/officer/content` | Officers edit the community links, Join page FAQ / “What we do” and the home Featured panel (stored in the database). Fixed links (email, calendar, mailing list) are in `src/lib/links.ts` |
| `supabase/migrations/` | Database schema, RLS policies and functions |
| `supabase/tests/` | Security tests |

## Security model

- **RLS on every table**, plus explicit grants, so access never depends on Supabase's default grants.
- **Event codes** live in `event_codes`, which only officers can read. Members never see codes.
- **Check-in** happens only through `public.check_in(code)`, a `security definer` function. It checks the code, that check-in is open (auto-closes at the end time unless an officer reopened it), and that the user hasn't checked in yet. It also rate-limits wrong codes (10 per 10 minutes). Members have no `INSERT` on `attendance`.
- **Officers**: `profiles.is_officer` can't be changed through the API. Only `public.set_officer()` changes it, only officers can call it, and it refuses to remove the last officer.
- **umich.edu only**, enforced in three places: the Supabase "Before User Created" hook (`public.hook_umich_only`), the OAuth callback, and the database functions/policies (JWT email check).
- **Site content** (links, FAQ, Featured panel): anyone can read it, only officers change it, through `public.save_*` functions that replace a section in one transaction and refuse to overwrite a newer save. Who edited last is recorded by triggers and only officers can read it.
- **The secret key is used in one file only**, `src/lib/push/send.ts`, to send push notifications (reading other members' devices, logging sent reminders). ESLint refuses any other import of `src/lib/supabase/admin.ts`. Everything else uses the publishable key and runs as the signed-in user under RLS.
- **Push notifications** are opt-in per device. Devices are saved only through `public.save_push_subscription()`, only for known push services (Apple, Google, Mozilla, Microsoft), and the service worker's re-subscribe endpoint takes same-site JSON only. Notifications never contain the game link.

## Local development

```bash
cp .env.example .env.local   # then fill in the publishable key
npm install
npm run dev                  # http://localhost:3000
```

Checks:

```bash
npm run typecheck
npm run lint
npm run test:db    # migrations + security tests in PGlite (in-process Postgres), no Docker needed
npm run build
```

Run the security tests against the hosted project (rolled back, leaves no data):

```bash
npx supabase db query --linked -f supabase/tests/security_test.sql
```

## Applying database changes

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

## Making the first officer

Sign in on the site once, then in the Supabase SQL Editor:

```sql
update public.profiles set is_officer = true where uniqname = 'youruniqname';
```

After that, officers promote and demote each other from **Officer → Members**.

## Environment variables

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → publishable key (or legacy anon key) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; `https://robloxatum.vercel.app` on Vercel (used in QR codes) |
| `CRON_SECRET` | Any long random string. Vercel sends it to the daily crons (`/api/keep-alive`, `/api/cron/reminders`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Push notifications: `npx web-push generate-vapid-keys`. The public key is built into the site, so redeploy after setting it. Never change them casually: every device would have to turn notifications on again |
| `VAPID_SUBJECT` | Optional. A `mailto:` or `https:` contact for push services; defaults to `NEXT_PUBLIC_SITE_URL` |
| `SUPABASE_SECRET_KEY` | Push notifications only: Supabase → Project Settings → API Keys → secret key. Server only, never `NEXT_PUBLIC_` |

Without the VAPID keys or the secret key, push notifications are simply off (the profile hides the setting).

## Installable app

`src/app/manifest.ts`, the icons in `public/icons/`, `src/app/apple-icon.png` and the iPhone launch screens in `public/splash/` (regenerate all with `python3 -I scripts/make-app-icons.py public/brand public src/app`). `public/sw.js` handles push notifications and shows `public/offline.html` when a page can't load; it caches nothing else. `/install` has the Add to Home Screen steps for iPhone and Android, and members on a phone browser get a "Get the app" bar.
