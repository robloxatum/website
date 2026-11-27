# 07 — OWASP ASVS 5.0, Level 2 coverage

_Statuses below are from round 1. Round 2 (2026-11-27) closed M-1, L-1, L-3 and L-6 and the L-2 text; see 05._

Mapped chapter by chapter and section by section. I don't quote individual requirement numbers, to avoid misnumbering; each row names the section topic and what was checked. Status:
- **Pass:** tested, or read in code with a test backing it.
- **Partial:** mostly met, with a gap named.
- **Gap:** not met, with a finding.
- **Dashboard:** can't be seen from the repo.
- **N/A:** the feature doesn't exist.

| Chapter | Section topic | Status | Evidence / finding |
|---|---|---|---|
| V1 Encoding & Sanitization | Output encoding (HTML, attributes, URLs) | Pass | React escaping; stored XSS payloads in title/location/description/labels rendered inert (app-local E-section); semgrep `raw-html-sink` 0 |
| | Injection (SQL, command, LDAP…) | Pass | All DB access through PostgREST/RPC with parameters; DEFINER functions have no dynamic SQL; no shell or `eval` in app code |
| | CSV/formula injection | Pass | `toCsv` prefixes `= + - @ \t \r` (restore drill confirms it round-trips) |
| | Safe deserialization / URL handling | Pass | `safeNext`, `isSitePath`, link normalizers + DB CHECKs (F-90–94, E-56–85) |
| V2 Validation & Business Logic | Input validation (allow-lists, types, lengths) | Partial | DB CHECKs and app validators everywhere; `"use cache"` arguments weren't validated (L-8, fixed) |
| | Business logic limits and anti-automation | Partial | check-in 10/10 min with per-user lock; Roblox lookups 20/min; device cap 10; no limit on RSVP/content saves (accepted); remote check-in by shared code (I-5) |
| | Sequential steps / race conditions | Pass | advisory locks on check-in, device save, `set_officer`; content version locks; parallel tests F-64, F-80 |
| V3 Web Frontend Security | Cookie attributes | Partial | SameSite=Lax, Path=/; Secure in production only; not HttpOnly (accepted: Supabase JS reads them); previews not Secure (I-12) |
| | Content Security Policy | Partial | strict `default-src`, `frame-src 'none'`, `object-src`… but `script-src 'unsafe-inline'` (accepted) |
| | Other browser headers (HSTS, nosniff, framing, referrer, permissions) | Pass | production headers checked; HSTS without preload (fine) |
| | Cross-origin requests / CSRF | Pass | Next action Origin check; push route Origin + JSON; sign-out Origin (I-3, fixed); SameSite=Lax |
| | External resources & links | Pass | `rel="noopener"` rule 0 hits; links normalized |
| V4 API & Web Service | HTTP method / content-type handling | Pass | route handlers export only the methods they need; push route requires JSON |
| | GraphQL / WebSocket | Pass / N/A | GraphQL not enabled (locally; confirm S-9); Realtime private channels with join-time RLS (D-160–164) |
| V5 File Handling | Upload type, size, name | Pass | bucket MIME allow-list, 5 MB limit, name regex, traversal normalized (D-175–185) |
| | Metadata stripping / storage outside webroot | Gap | EXIF/GPS kept (L-1) |
| | Download / serving safety | Partial | images only; no `nosniff` on Storage objects (I-10) |
| V6 Authentication | Password, MFA, recovery | N/A | Google OAuth only; MFA is Google/U-M Duo |
| | Restricting who can register | Pass | hook `hook_umich_only` + callback check + `is_umich` in RLS (B-01–05, C-62); the `LIKE` pattern is loose (I-4) |
| | Account enumeration | Pass | no sign-up form, no email lookups; RPC errors check role before existence |
| V7 Session Management | Session tokens, rotation, timeout | Partial | Supabase JWT 1 h + rotating refresh token; global sign-out revokes refresh (B-209/210); access token valid until expiry after sign-out (accepted) |
| | Re-authentication / termination on privilege change | Partial | role read from DB on each query, so a demoted officer loses access immediately; an open Realtime channel keeps counts (I-1) |
| V8 Authorization | Function-level (who can call what) | Pass | 24/24 actions call an auth helper; officer actions refused to members (app-local C-section); RPC grants (D-190–203) |
| | Data-level (IDOR, row and column) | Pass | 212-check persona matrix; column grants (C-28–33) |
| | Owner-only operations | Pass | `set_officer` owner-only; last-owner trigger (C-137–144) |
| V9 Self-contained Tokens | Signature, algorithm, expiry validation | Pass | tampered/`none`/HS256 guess/expired → 401 (B-205–208); `getClaims()` verifies on the server |
| V10 OAuth & OIDC | Client: PKCE, state, redirect URIs | Partial | PKCE via `@supabase/ssr`; `next` sanitized; **redirect URL allowlist is in the dashboard** (S-3) |
| | Consent / scopes | Dashboard | Google consent screen and scopes (G-1–G-4) |
| V11 Cryptography | Algorithms, randomness, secret comparison | Pass | `timingSafeEqual` for cron; codes from `gen_random_bytes` (pgcrypto); VAPID ECDSA via `web-push` |
| | Key management / rotation | Partial | CRON_SECRET never rotated (accepted); rotation procedure in 10 |
| V12 Secure Communication | TLS everywhere, HSTS | Pass | Vercel and Supabase HTTPS only; HSTS 2 years; push and Roblox fetches over https; push requests use `redirect: "error"` |
| V13 Configuration | Secrets out of code and client | Pass | gitleaks history 0; secret key used only in `push/send.ts` (grep + semgrep rule) |
| | Dependency management | Pass / Partial | npm audit 0, osv 0, lockfile integrity; CI actions not SHA-pinned (L-6) |
| | Environment separation | Gap | dev → production DB, CLI linked to production (L-5); previews unknown (I-12) |
| | Debug / test features off in production | Pass | test sign-in not compiled into prod builds, 404 on production, prod-build check in e2e |
| | Unintended exposure of internal functions | Gap → fixed | `"use cache"` functions reachable as actions (L-8) |
| V14 Data Protection | Data classification & minimization | Partial | 03 inventory; retention not stated; wrong-code times not purged on schedule (L-2) |
| | Caching of sensitive responses | Partial | `private, no-store` locally; Vercel shell `public, max-age=0` (I-2, needs a signed-in check) |
| | Aggregates that reveal individuals | Gap | counts < 10 through RPC (L-3) |
| | Privacy notice accuracy | Gap | L-2 |
| V15 Secure Coding & Architecture | Defense in depth, least privilege | Pass | RLS + app checks; private schema not exposed; DEFINER with `search_path=''` |
| | Third-party component safety | Pass | 512 deps, 0 known vulns, no install scripts |
| | Resource limits on outbound calls | Partial | Roblox timeouts + batch limit; image optimizer open to `*.rbxcdn.com` (M-1) |
| V16 Logging & Error Handling | Security event logging / audit trail | Gap | no audit log of exports, roles, check-in removals (L-4); platform logs short-lived on free plans |
| | Errors don't leak internals | Pass | actions return codes like `not_signed_in`; DB errors mapped; Next production error pages |
| V17 WebRTC | — | N/A | not used |

**Counts (computed from the table):** 46 rows: 23 Pass, 1 Pass / N/A, 1 Pass / Partial, 12 Partial, 5 Gap, 1 Gap → fixed on branch, 1 Dashboard, 2 N/A.
