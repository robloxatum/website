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
| `src/lib/links.ts` | **Edit this** to fill in Discord, Instagram, etc. |
| `supabase/migrations/` | Database schema, RLS policies and functions |
| `supabase/tests/` | Security tests |

## Security model

- **RLS on every table**, plus explicit grants, so access never depends on Supabase's default grants.
- **Event codes** live in `event_codes`, which only officers can read. Members never see codes.
- **Check-in** happens only through `public.check_in(code)`, a `security definer` function. It checks the code, that check-in is open (auto-closes at the end time unless an officer reopened it), and that the user hasn't checked in yet. It also rate-limits wrong codes (10 per 10 minutes). Members have no `INSERT` on `attendance`.
- **Officers**: `profiles.is_officer` can't be changed through the API. Only `public.set_officer()` changes it, only officers can call it, and it refuses to remove the last officer.
- **umich.edu only**, enforced in three places: the Supabase "Before User Created" hook (`public.hook_umich_only`), the OAuth callback, and the database functions/policies (JWT email check).
- **No secret key anywhere.** The app uses only the publishable key; everything runs as the signed-in user under RLS.

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
