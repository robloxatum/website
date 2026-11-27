# 08 — Owner dashboard checklist

These settings can't be checked from the repo, so do them yourself, signed in as the owner. Menu names are as of late 2026 and may move; search the settings page for the bold word if a path doesn't match. Tick each box and write what you found. **Do the ★ items before Sunday, Nov 29.** Never paste keys or secrets into chat or into this file.

## 0. Two-factor authentication on every account that can change the site ★
- [ ] **Google (club Gmail)**: myaccount.google.com → **Security** → **2-Step Verification** → turn on; add a **passkey** or security key and print **backup codes** (store them offline, not in the Gmail itself).
- [ ] **Your own Google account** (if it owns the Google Cloud project): same steps.
- [ ] **GitHub**: github.com → avatar → **Settings** → **Password and authentication** → **Two-factor authentication** → enable (authenticator app or passkey); save recovery codes.
- [ ] **Vercel**: vercel.com → avatar → **Account Settings** → **Authentication** → **Two-Factor Authentication** → enable. If you sign in to Vercel with GitHub, GitHub 2FA covers it, but turn it on anyway.
- [ ] **Supabase**: supabase.com/dashboard → avatar → **Account preferences** → **Security** / **Multi-factor authentication** → add an authenticator app. If you sign in with GitHub, GitHub 2FA covers it.
- [ ] **Discord**: User Settings → **My Account** → **Enable Two-Factor Auth**; in the server: Server Settings → **Safety Setup** → **Require 2FA for moderator actions** on.
- [ ] **GroupMe**: it signs in with Microsoft or phone; turn on 2FA on that Microsoft account (account.microsoft.com → **Security**).
- [ ] Write down who else has access to each account (section 8).

## S. Supabase (project used by robloxatum.vercel.app)
- [ ] **S-1 ★ Auth hook enabled**: Authentication → **Hooks** → "Before User Created" points at `public.hook_umich_only` and is **enabled**. (Without it, any Google account can sign up; the app and RLS still refuse non-umich, but accounts would be created.)
- [ ] **S-2 Providers**: Authentication → **Sign In / Providers**: only **Google** enabled; **Email**, **Phone**, **Anonymous** off. (Production `/auth/v1/settings` confirmed this on 2026-11-27.)
- [ ] **S-3 ★ Redirect URLs**: Authentication → **URL Configuration**:
  - **Site URL** = `https://robloxatum.vercel.app`.
  - **Redirect URLs** contain only exact entries such as `https://robloxatum.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`.
  - **No wildcards** like `https://*.vercel.app/**` or `**`: anyone can deploy to `*.vercel.app` and would receive sign-in codes.
  - If you need previews, add only your team's preview pattern (`https://robloxatum-*-<your-team>.vercel.app/**`).
- [ ] **S-4 Google provider secret**: Authentication → Providers → Google: the Client ID matches the Google Cloud project in G-1; "Skip nonce check" **off**.
- [ ] **S-5 ★ API keys**: Project Settings → **API Keys**:
  - The site uses the **publishable** key.
  - The **secret** key is only in Vercel production env (V-3).
  - Legacy `anon`/`service_role` JWT keys: if the app doesn't use them, **disable legacy keys**.
  - If the secret key ever appeared anywhere besides Vercel, **roll it**.
- [ ] **S-6 Data API**: Project Settings → **Data API**: exposed schemas are **`public` only** (not `private`); **max rows** 1000 (L-7).
- [ ] **S-7 Security Advisor**: Advisors → **Security Advisor** → expect the 11 accepted warnings and nothing new. Note any new item.
- [ ] **S-8 Leaked-password protection**: off (accepted; there are no passwords).
- [ ] **S-9 Extensions**: Database → **Extensions**: `pg_graphql` **off** (the app doesn't use it), unless you know why it's on.
- [ ] **S-10 Backups**: Database → **Backups**: note what your plan offers. On the free plan, assume **there's no restorable backup** and keep the officer `backup.zip` (10-maintenance).
- [ ] **S-11 Storage**: Storage → `event-flyers` → bucket settings: Public on, size limit 5 MB, allowed types `image/png, image/jpeg, image/webp`.
- [ ] **S-12 Realtime**: Realtime → **Settings**: "Allow public access" **off** (private channels only), if the option is shown.
- [ ] **S-13 Team**: Organization → **Team**: only people who need it; remove ex-officers. Owner role only for you.
- [ ] **S-14 Auth rate limits & sessions**: Authentication → **Rate Limits** (defaults are fine); **Sessions** → consider "Inactivity timeout" (for example 30 days) so old devices sign out.
- [ ] **S-15 Region & pausing**: Project Settings → General: note the region (for the privacy page). Free projects pause after inactivity; the keep-alive cron prevents it. Check **Logs → Cron**, or that `/api/keep-alive` shows in Vercel logs daily.
- [ ] **S-16 Database password**: Project Settings → **Database** → reset the DB password if it was ever shared or written down.

## V. Vercel (project robloxatum)
- [ ] **V-1 ★ Team members**: Team → **Settings** → **Members**: only you (and people you trust with production). Hobby is single-user: make sure nobody else knows the login.
- [ ] **V-2 ★ Deployment Protection**: Project → **Settings** → **Deployment Protection** → **Vercel Authentication** on for **Preview** (Standard Protection). Then strangers can't open preview builds that talk to your production database.
- [ ] **V-3 ★ Environment variables**: Project → Settings → **Environment Variables**: for each variable, check which environments it's in:
  - `SUPABASE_SECRET_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`: **Production only**, type **Sensitive**.
  - `NEXT_PUBLIC_*`: as needed.
  - **No `E2E_TEST_AUTH` or `E2E_TEST_PASSWORD` anywhere.**
  - If previews get the production Supabase URL, they write to production (point Preview at nothing, or turn previews off: Settings → Git → "Ignored Build Step" or disconnect branch deploys).
- [ ] **V-4 Git**: Settings → **Git**: production branch `main`. **Fork PR deployments**: off, or require authorization.
- [ ] **V-5 Domains**: Settings → **Domains**: only `robloxatum.vercel.app` (and any custom domain you own). Remove stale ones.
- [ ] **V-6 Signed-in caching (I-2)**: in Chrome, sign in on the live site, open DevTools → **Network**, reload `/profile`, click the document request, and read **Response Headers → Cache-Control**. Expect `private` or `no-store`. If it says `public` with `s-maxage`, tell me: that would be a real issue.
- [ ] **V-7 Cron jobs**: Settings → **Cron Jobs**: two jobs (`/api/keep-alive`, `/api/cron/reminders`), both successful recently.
- [ ] **V-8 Usage**: Usage tab: note Image Optimization transformations and Function invocations this month (for M-1). Set a usage notification if offered.
- [ ] **V-9 Logs & analytics**: Analytics on (it has no cookies). Note how long logs are kept on Hobby, for 09.
- [ ] **V-10 Access tokens**: Account Settings → **Tokens**: delete tokens you don't use.

## G. Google Cloud (OAuth client used by Supabase)
- [ ] **G-1 ★ Project owners**: console.cloud.google.com → pick the project → **IAM & Admin → IAM**: only you, plus the club Gmail as a backup owner.
- [ ] **G-2 OAuth consent screen**: **Google Auth Platform → Branding**: app name "Roblox at UM" (a club, not "University of Michigan"); support email = club Gmail; authorized domain `vercel.app` / your domain; privacy policy link `https://robloxatum.vercel.app/privacy`.
- [ ] **G-3 Scopes**: **Data Access**: only `openid`, `email`, `profile`. No sensitive scopes.
- [ ] **G-4 Client**: **Clients** → the web client: **Authorized redirect URIs** = only `https://<project-ref>.supabase.co/auth/v1/callback` (and the local one if you use it). No JavaScript origins needed. If the client secret was ever shared, **reset the secret** and paste the new one into Supabase S-4.
- [ ] **G-5 Publishing status**: Audience → "In production" or "Testing". In Testing, only listed test users can sign in. Check that it's what you intend before Sunday.

## H. GitHub (repository)
- [ ] **H-1 ★ Visibility & collaborators**: repo → **Settings → Collaborators**: only people who need write access.
- [ ] **H-2 Branch protection**: Settings → **Rules → Rulesets** (or Branches) → protect `main`: require a pull request, require the `e2e` check, block force-push and deletion.
- [ ] **H-3 Actions token**: Settings → **Actions → General → Workflow permissions** → **Read repository contents** (read-only). Disable "Allow GitHub Actions to create and approve pull requests" if you don't use it. (L-6)
- [ ] **H-4 Secret scanning**: Settings → **Code security** → enable **Secret scanning** and **Push protection** (free for public repos; for private ones it depends on the plan); enable **Dependabot alerts**.
- [ ] **H-5 Deploy keys / apps**: Settings → **Deploy keys** and **GitHub Apps**: only Vercel (and what you recognize).

## M. Club Gmail
- [ ] **M-1 ★ 2FA** (section 0) and a **recovery phone/email** you control.
- [ ] **M-2 Who knows the password**: change it if ex-officers knew it.
- [ ] **M-3 Third-party access**: myaccount.google.com → **Security → Your connections to third-party apps & services**: remove unknown ones.
- [ ] **M-4 Forwarding & filters**: Gmail → Settings → **Forwarding and POP/IMAP** and **Filters**: no unknown forwarding (a common takeover persistence trick).
- [ ] **M-5 Recent security activity**: check for unknown sign-ins.

## F. Google Form & Sheet ("Get event updates")
- [ ] **F-1 Responses sheet sharing**: open the Sheet → **Share**: only officers by name, "General access: **Restricted**". Not "Anyone with the link".
- [ ] **F-2 Form settings**: Settings → **Responses**: "Collect email addresses" only if needed; "Allow response editing" off; **don't** show "See summary charts and text responses" to respondents.
- [ ] **F-3 Retention**: decide how long to keep responses (for example delete each summer) and add that to the privacy page (03 §5.6).
- [ ] **F-4 Calendar**: Google Calendar → the club calendar → Settings → **Access permissions**: public "See all event details" is fine for events. Make sure no private notes or member emails are in event descriptions or guest lists.

## D. Discord
- [ ] **D-1 Roles**: Server Settings → **Roles**: only officers have Administrator / Manage Server / Manage Webhooks.
- [ ] **D-2 Integrations & webhooks**: Server Settings → **Integrations**: remove unknown bots and webhooks.
- [ ] **D-3 Invites**: Server Settings → **Invites**: revoke old permanent invites. The site's Discord link should be one you control (Links page).
- [ ] **D-4 Safety**: **Safety Setup**: verification level ≥ Low, DM spam filter on, 2FA for moderators (section 0).

## P. GroupMe
- [ ] **P-1 Owners/admins**: Group → **Settings → Members**: only officers are admins; you're the owner.
- [ ] **P-2 Share link**: regenerate the join link if it was posted somewhere public you don't want, and update the Links page.

## 8. Write this down (offline, for 09)
- [ ] Who has admin on: Supabase org, Vercel, Google Cloud project, GitHub repo, club Gmail, Discord, GroupMe.
- [ ] Where backup codes are stored (a physical place or a password manager, not the club Gmail).
- [ ] A second trusted officer who can reach you if something breaks (they don't need the passwords).
