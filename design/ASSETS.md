# Artwork shopping list

Every image below is **optional**. Until a file exists, the site draws a vector
fallback (SVG cubes, a voxel skyline, a block calendar), so nothing ever looks
broken. To swap one in:

1. Export it at the size listed and drop it in `public/art/`.
2. Set its path in `src/content/art.ts` (e.g. `covers.game_night: "/art/cover-game-night.png"`).
3. Push. That's it: next/image serves AVIF/WebP at the right size, so you can
   export PNG (or high-quality JPEG for photos) and don't need to compress by hand.

## Rules for every image

- **No Block M, "Michigan" wordmark, or other University of Michigan marks**:
  not on flags, banners, buildings, jerseys or characters' shirts. Maize and
  blue colors are fine. (Student orgs need university approval to use the marks.)
- **No official Roblox logos** (the tilted-square "R" mark, the Roblox wordmark,
  Studio icons). Our own club mark is the only exception.
- **Characters are original block-style figures**: our own proportions, faces
  and outfits, not copies of Roblox's default avatars or any specific game's
  characters.
- Dark scenes read best: the UI is navy `#061525` with maize `#F0C413` accents,
  and every image is blended into the page with dark gradients.
- Leave important things away from the edges; most slots are cropped.

**Exception: `public/art/mascot.png`.** The club mascot is the one image allowed
to show a Block M, on its outfit. It is used as-is and only through
`<Mascot />` (home join banner). Don't copy that mark into any other image.

---

## 1. Home hero (already has a placeholder)

| | |
|---|---|
| **File** | `public/art/hero-campus.png` (path set in `art.ts` → `hero`) |
| **Size** | 2560 × 1100 px (about 2.33 : 1). The current placeholder is 1915 × 821. |
| **Where** | Behind the logo and buttons at the top of the home page. |

**How it's cropped**

- **Desktop:** fills the hero, anchored to the right edge. The **left ~40%** sits
  under a dark gradient behind the logo, pitch and buttons, so keep it quiet:
  sky, distant trees, nothing important.
- **Phones:** a box at the bottom of the hero, cropped around **76% from the left**
  and the **bottom edge**. Whatever is in that region shows on phones (the tower
  and characters in the current placeholder).
- **Bottom ~15%** fades into the page on every screen.

**Description:** A dusk scene on a voxel college campus. A tall stone
carillon/clock tower (inspired by a collegiate Gothic bell tower, not a replica)
stands right of center with warm lit windows. Blocky trees, lamp posts and a
brick plaza lead toward it. In the foreground, 3–6 original block characters in
maize-and-navy clothes (plain, no letters or logos) hang out, wave and sit on a
bench. Sky: deep navy to purple with warm orange near the horizon; a few small
floating maize and blue cubes. Best source: a Roblox Studio build screenshot
with the camera low and slightly to the left.

## 2. `/join` banner

| | |
|---|---|
| **File** | `public/art/join-banner.png` → `art.ts` `joinHero` |
| **Size** | 1600 × 686 px (21 : 9) |
| **Where** | Top of `/join`, the flyer landing page, above the logo. |

**How it's cropped**

- 21:9 from tablet width up.
- **3:1 on phones**, cropped evenly from the top and bottom; keep the subject in
  the middle band.
- Bottom half darkens slightly.

**Keep it light:** this page is opened from a flyer QR over cellular data. A
simple scene compresses well; avoid fine noise and film grain.

**Description:** Wide, friendly group shot: a row of 4–6 original block
characters at a game night (laptops, a projector screen glowing maize, snacks
on a table) or posing in front of the voxel campus tower. Warm and welcoming;
the first impression for someone who has never heard of us.

## 3. Event covers (one per category)

| | |
|---|---|
| **Files** | `public/art/cover-<category>.png` → `art.ts` `covers.<category>` |
| **Size** | 1600 × 900 px (16 : 9) each |
| **Categories** | `game_night`, `workshop`, `game_jam`, `social`, `meeting`, `partner` |
| **Where** | Event cards (home, `/events`), event detail header, officer dashboard thumbnails. |

**Crops** (keep the subject inside the **center 900 × 600** safe zone):

- **Square:** phone event rows and officer cards.
- **2:1:** event cards from tablet width up.
- **4:3:** officer past-event rows.
- **16:7 / 16:6:** event detail header.

The bottom half gets a dark gradient, and a small category badge sits at the
**bottom-left** of grid cards, so keep that corner simple.

**Descriptions**

- **Game Night:** original block characters around a glowing screen holding
  controllers; purple-blue lighting with maize accents.
- **Workshop:** a block character at a desk with a laptop showing abstract code
  blocks and a floating 3D-gizmo of cubes; blue tones.
- **Game Jam:** a team of block characters around a table covered in sticky
  notes, a countdown clock and a trophy made of cubes; maize-gold tones.
- **Social:** block characters laughing on a voxel lawn or at a pizza night;
  green-teal tones.
- **Meeting:** a voxel lecture room with a projector slide of cubes and a
  character presenting; navy-slate tones.
- **Partner Event:** two groups of block characters meeting in the middle with
  a handshake, a stage or a banner with **no logos or text**; amber tones.

## 4. Featured panel image

| | |
|---|---|
| **File** | `public/art/featured-game-jam.png` → `art.ts` `featured` |
| **Size** | 1200 × 675 px (16 : 9) |
| **Where** | The "Featured: 72-hour Game Jam with Roblox" panel on the home page, above its title. Replaces the trophy icon and cubes. |

**Description:** A real photo from the jam (teams at laptops, the room, the
showcase) is best; crop out faces of anyone who didn't agree to be on the site.
Otherwise use a render of block characters celebrating with a cube trophy. A
photo here is fine: it's the one slot that's about a real event.

## 5. Empty-state illustration

| | |
|---|---|
| **File** | `public/art/empty-calendar.png` → `art.ts` `emptyState` |
| **Size** | 480 × 360 px (4 : 3), **transparent background** |
| **Where** | "Ready for the next game night?" / "Nobody has checked in yet" / no-events states, shown about 170–210 px wide. |

**Description:** A chunky voxel calendar (maize header, light page, one maize
day square highlighted) on a small floating isometric navy platform, with two
or three little sparkles. Simple shapes, no text, since it's shown small.

---

## Already in place (no action needed)

| File | Size | Use |
|---|---|---|
| `public/art/mascot.png` | 268 × 504, transparent | Club mascot on a maize glow in the home join banner. Never shown larger than natural size. The Block M exception above applies to this file only. |
| `public/brand/*` | various | Logos, wordmarks and tagline lockups (header, footer, sign-in, present page, QR center). |
| `src/app/opengraph-image.png`, `src/app/(main)/join/opengraph-image.png` | 1200 × 630 | Link previews for `/` and `/join` (built from the tagline logo by `scripts/make-brand-assets.py` and `scripts/make-join-og.py`). |
