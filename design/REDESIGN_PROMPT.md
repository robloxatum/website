# Roblox at UM: Website Redesign + Public "Join" Hub

Redesign the Roblox at UM website. The three reference mockups are in `design/mockups/`. Open and study them before planning. This is a full visual overhaul, not a recolor.

The site now has three jobs, in this order of importance:

1. **Front door for new people.** Our flyers will carry a QR code. Someone who has never heard of us scans it on their phone and, within about 10 seconds, should understand who we are, see what's coming up, and know how to join.
2. **Events hub.** Upcoming and past events for members.
3. **Attendance.** The existing room QR / 5-letter code check-in, plus the officer tools.

---

## 0. How to work (read first)

- **Work on a new git branch called `redesign`. Do not change `main`.** The live site runs real attendance (a soft launch on Dec 10), so it must keep working. Push the branch so Vercel builds a preview deployment, and tell me exactly which Supabase redirect URL I need to add for preview sign-in to work.
- Before planning, inspect the codebase, routes, components, auth, database schema, migrations and security tests.
- **Plan first and show me the plan.** Then build in phases and stop for my review after each one:
  1. Design system (tokens, fonts, core components) + public Home + `/join`. These are flyer-critical.
  2. Events list, event detail, and the member check-in flow.
  3. Officer portal (dashboard, events, members, flyer QR tool).
  4. Artwork swap-in, polish, and a full desktop + mobile review.
- After each phase, run a production build and the existing security tests, and screenshot the changed pages at desktop (1440px) and phone (390px) widths. Compare them against the mockups and fix anything that looks empty, generic or inconsistent before showing me.

## 1. Preserve everything that works

Keep all existing authentication (Google, umich.edu only), the umich-only hook, officer/member permissions, RLS policies, the `check_in()` function, rate limiting, code generation, the officer-only realtime count, CSV export (with formula escaping), auto-close at event end, and every existing route and its behavior.

- **Do not change the check-in mechanism.** Members scan the room QR or type the code. The mockup's "Scan Member QR" screen (an officer scanning members) is NOT something we're building. Apply its visual style to our existing flow instead.
- **Do not fabricate anything.** No fake members, attendance, events, activity or stats. The numbers and event names in the mockups are illustrative only.
- **No nonfunctional UI.** No notification bell, Analytics, Settings or Resources tab, and no search or filters, unless they actually work. Leave out anything from the mockups we don't have a feature for.
- **Don't expose member data publicly.** The privacy page promises that only officers see who attended. No public activity feeds, member lists, or "X joined" items. Public pages may show aggregate counts only.

## 2. Brand (use ours, not the mockups')

- **Logos:** use our real files in `public/brand/` instead of the mockups' generic cube:
  - `robloxatum_logo_transparent.png`: square icon, works on any background
  - `robloxatum_no_tagline_transparent.png` / `RobloxAtUM_tagline_transparent.png`: white text, for dark backgrounds
  - `..._transparent_navy.png` versions: navy text, for light backgrounds
  - The solid-background originals: only for social preview images
- **Tagline:** "Build · Create · Connect" (not the mockup's "Build · Play · Create · Collaborate").
- **Colors:** dark layered navy UI with maize accents. Match the maize to our logo:
  - Maize (primary accent): `#F0C413`
  - Brand navy: `#081F40`
  - Primary background: `#061525`
  - Secondary background: `#091F35`
  - Card surface: `#102C46`
  - Elevated surface: `#163956`
  - Border: `#294B6A`
  - Primary text: `#F5F7FA`
  - Secondary text: `#A9BED0`
  - Muted text: `#7893AB` (check contrast; lighten if it fails WCAG AA for body text)
  - Success: `#34D399`
  - Error: `#F87171`
  - Use subtle gradients and lighting for depth. Skip neon, glowing borders, and the old cream grid background.
- **Typography:** Montserrat (bold/extrabold) for display headings and branding, to match our logo. Inter for body, navigation, forms and buttons. Use uppercase only for section labels.
- **Trademarks:**
  - No University of Michigan Block M or UM wordmarks anywhere, including on artwork, flags and characters' shirts. Student orgs need approval to use them. "Maize and blue" colors are fine.
  - No official Roblox logos beyond our own club mark.
  - Keep "Not affiliated with or endorsed by Roblox Corporation" in the footer.
  - Characters must be original block-style figures, not copies of Roblox avatars.

## 3. Pages

### Public
- **Home (`/`):** follow the public mockup's composition:
  - Hero: our wordmark, a one-line description ("A student-led community for Roblox creators, players, and developers at U-M"), and primary/secondary CTAs ("Join the Community" → `/join`, "View Events").
  - A stats bar (see section 4).
  - Upcoming events as cards with cover art.
  - A "What we do" strip (Game Nights, Workshops, Game Jams, Community).
  - A join banner.
  - Replace the mockup's "Community Activity" panel with something real, such as the next event highlight or "Featured: our 24-hour Game Jam with Roblox."
- **`/join` (flyer landing page; this is where flyer QR codes point):**
  - Built for a first-time visitor on a phone over cellular data. **No sign-in required to view.**
  - Above the fold: logo, a one-sentence pitch, the next upcoming event (date, time, place), and the join actions.
  - Join actions, in this order:
    1. **"Sign up with your umich account":** uses the existing Google sign-in. It creates their member profile (the existing welcome flow), so check-in is one tap later. Afterwards, show a "You're in!" screen with our community links.
    2. Join our Discord
    3. Follow our Instagram
    4. Maize Pages
  - Below: what we do, what a typical meeting looks like, "No experience needed," and an FAQ (cost: free; experience: none needed; when/where we meet).
  - Accept an optional `?src=` parameter (e.g. `/join?src=flyer-winter27`) for analytics. It must not affect the page.
- **Events (`/events`, `/events/[id]`):** card grid with cover art, category badge, date/time, location, and a status pill (Upcoming / Live / Completed). Show attendance counts on public pages only as an aggregate, and only for past events. The tabs from the mobile mockup (Upcoming / Past / All) are fine.
- **Links (`/links`):** keep it working (it's in our Instagram bio), restyled to match.
- **Privacy (`/privacy`):** keep it, restyled.

### Members
- **Check-in (`/checkin`, `?code=`):** follow the mobile check-in mockup's look:
  - Show the event card at the top once the code resolves.
  - A large 5-box code input and a big maize Check In button.
  - Large, full-screen success, already-checked-in, closed and invalid-code states, with a short success animation.
  - Fast on phones; nothing should slow this flow down.
- **Profile / welcome:** restyled, same behavior.

### Officers
- **Portal layout:** a sidebar on desktop (Dashboard, Events, Members) and a bottom nav on mobile, as in the mockups.
- **Dashboard:**
  - Summary cards from real data: upcoming events, total members (profiles), total check-ins.
  - A maize New Event button.
  - Upcoming/live and past event cards with thumbnail, date, location, status and attendance count.
  - The mockup's empty state ("Ready for the next game night?").
- **Events and Members pages:** restyled, same functionality.
- **Capacity / progress bars:** add an optional `capacity` field to events through a new migration. It must preserve RLS, so update the security tests if needed. Show "78 / 132 checked in" progress bars only when a capacity is set. If this adds real complexity, skip it and tell me.
- **Present page:** restyled with our logo and colors. It must stay readable from the back of a room, with a huge code and QR.
- **New: Flyer QR tool:**
  - An officer page that generates a QR code for `https://<site>/join?src=<label>`, with our square logo in the center.
  - A text field for the label.
  - Download as PNG (high-res, at least 2000px) and SVG for printing.
  - Use the same QR library as the present page, with high error correction so the center logo doesn't break scanning.

## 4. Stats (real data only)

- **Live stats from the database:** members (profile count), events held, and total check-ins. Show a stat publicly only once it's meaningful (e.g. hide it while it's under 10) so the site never looks empty.
- **Officer-editable highlights:** keep these in one config file with a "last verified" date:
  - "100+ members in our first 3 weeks"
  - "4,100+ Instagram followers"
  - "24-hour Game Jam with Roblox: 22 participants, 6 games"
  - I'll verify these numbers. Never compute or invent new ones.

## 5. Artwork

The artwork carries the brand, but you can't generate illustrated images. So:

- Build reusable art components (hero scene, event cover, empty-state illustration, banner character) that take an image path and blend it into the UI with gradients and masks.
- Until real art exists, ship tasteful fallbacks: layered SVG isometric maize/blue cubes and a simple voxel skyline in SVG/CSS. No emojis, and no broken or placeholder text visible to users.
- Event cover art: use an optional `cover_image` per event if easy. Otherwise use a few category-based covers (Game Night, Workshop, Game Jam, Social).
- **Create `design/ASSETS.md`** listing every image the site needs. For each one, include:
  - filename and path
  - exact pixel size and aspect ratio
  - where it appears
  - a detailed description I can use to create it (voxel U-M campus with a Burton-Tower-inspired tower, original block characters in maize and blue with no Block M, category covers, empty-state calendar, etc.)
  - I'll make these myself (image generation, Blender, or a Roblox Studio build) and drop them into `public/art/`.
- Optimize all images (AVIF/WebP via next/image) and lazy-load everything below the fold.

## 6. Components, motion, accessibility, performance

- **Design system:** shared tokens and reusable components, with no page-specific one-off styling. Cover buttons, header/nav (desktop + mobile bottom bar), event cards, stat cards, status pills, form fields, tabs, tables, progress bars, loading skeletons, toasts and empty states. Use Lucide icons and 8–16px corner radii.
- **Motion:**
  - Hover/press states, slight card lift, animated tab/nav indicators, a check-in success animation, gentle floating cubes in the hero.
  - Interface animations run 150–300ms.
  - Respect `prefers-reduced-motion`.
  - Nothing may slow down check-in.
- **Accessibility:** WCAG AA contrast, 44px minimum touch targets, keyboard navigation, visible focus rings, semantic HTML, alt text on every image and logo.
- **Performance:**
  - `/join` and `/checkin` must load fast on a phone over cellular: aim for LCP under 2.5s, a hero image of about 200KB or less, and priority loading for the hero.
  - No horizontal overflow at any width.
- **Sharing:**
  - Open Graph/Twitter preview images for `/` and `/join`, built from our tagline logo.
  - Enable Vercel Web Analytics (cookie-free) so we can see `/join` visits by `src`. Tell me if it needs a dashboard toggle.

## 7. Deliverables

- The plan, then each phase on the `redesign` branch with desktop + phone screenshots.
- `design/ASSETS.md` (the art shopping list).
- A short list of anything I need to configure (Supabase preview redirect URL, Vercel Analytics toggle, the new migration).
- Don't merge into `main` until I approve.

The finished site should feel like a polished gaming community platform with its own recognizable identity, not a template with Michigan colors.
