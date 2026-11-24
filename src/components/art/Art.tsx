import Image from "next/image";
import { art } from "@/content/art";
import { categoryInfo } from "@/lib/categories";
import type { EventCategory, EventCoverImage } from "@/lib/types";
import { CubeCluster } from "./Cubes";
import { VoxelSkyline } from "./Skyline";

/**
 * Reusable art frames. Each takes an optional image (from src/content/art.ts)
 * and blends it into the UI with gradients and masks; without one it draws a
 * vector fallback, so nothing ever shows as broken.
 */

const fadeLeft = "[mask-image:linear-gradient(to_right,transparent,black_35%)]";

/**
 * Desktop hero image: fade all four edges into the page so no image edge (or the
 * sketch's frame lines) ever shows; the long left fade melts the hatched sky into
 * the navy behind the text. Phones crop the sides off and fade top/bottom with
 * overlays instead.
 */
const heroEdgeMask =
  "lg:[mask-image:linear-gradient(to_bottom,transparent,black_10%,black_86%,transparent),linear-gradient(to_right,transparent,black_30%,black_95%,transparent)] lg:[mask-composite:intersect]";

/**
 * Hero background for the home page. With an image (src/content/art.ts) it
 * fills the hero: on phones it's cropped toward the right so the tower and
 * characters stay in view, under a darker overlay for the text; from lg up a
 * left-side gradient keeps the logo and buttons readable. Without an image it
 * falls back to the SVG skyline. The bottom always fades into the page.
 */
export function HeroScene({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {art.hero ? (
        <>
          {/* Phones/tablets: the scene sits in the lower part of the hero (tower behind the
              text, characters below the buttons). From lg up it is as tall as the hero, at its
              own aspect ratio (never cropped), pinned right: on wide screens the scene stays
              beside the text instead of growing behind it. */}
          <div
            className={`absolute inset-x-0 bottom-0 h-[440px] sm:h-[560px] lg:inset-y-0 lg:right-0 lg:left-auto lg:aspect-[1915/821] lg:h-full ${heroEdgeMask}`}
          >
            <Image
              src={art.hero}
              alt=""
              fill
              preload
              fetchPriority="high"
              // Same look as 75 for pencil lines on flat navy, at half the bytes
              // (~39 KB AVIF at full size, the most any screen downloads).
              quality={50}
              // Cover-cropping scales the image past the screen width on phones.
              sizes="(max-width: 1023px) 1100px, 1400px"
              className="object-cover object-[76%_100%]"
            />
            {/* Phones: fade the top into the page and darken behind the text. */}
            <div className="absolute inset-0 bg-linear-to-b from-bg via-bg/70 via-50% to-bg/10 to-80% lg:hidden" />
          </div>
          {/* Desktop: soft navy over the left half (the sketch's hatched sky) so the logo,
              tagline and buttons stay crisp; clear over the tower and characters. */}
          <div className="absolute inset-0 hidden bg-linear-to-r from-bg via-bg/80 via-30% to-transparent to-55% lg:block" />
        </>
      ) : (
        <div className={`absolute inset-y-0 right-0 w-full lg:w-[62%] ${fadeLeft}`}>
          <VoxelSkyline className="absolute inset-0 size-full opacity-30 lg:opacity-100" />
        </div>
      )}
      {/* Blend into the page at the bottom */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-bg to-transparent sm:h-36 lg:h-16" />
    </div>
  );
}

/**
 * Cover for an event card or page banner. With `cover` (an uploaded cover or a
 * default from public/art/covers) it shows that image, cropped to the box from
 * the center. Without one it draws the category art. A soft gradient at the
 * bottom keeps the category badge that overlaps it readable.
 */
export function EventCover({
  category,
  cover,
  className = "",
  sizes = "(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw",
  preload = false,
}: {
  category: EventCategory | string;
  cover?: EventCoverImage | null;
  className?: string;
  sizes?: string;
  preload?: boolean;
}) {
  if (cover) {
    return (
      <div aria-hidden={cover.alt ? undefined : true} className={`relative overflow-hidden bg-bg-2 ${className}`}>
        <Image
          src={cover.src}
          alt={cover.alt}
          width={cover.width}
          height={cover.height}
          sizes={sizes}
          preload={preload}
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-[#0d2741]/75 to-transparent" />
      </div>
    );
  }
  const info = categoryInfo(category);
  const src = art.covers[category as EventCategory] ?? null;
  const Icon = info.icon;
  return (
    <div aria-hidden="true" className={`relative overflow-hidden ${className}`}>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${info.from}, ${info.to})` }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgb(255_255_255/0.18),transparent_55%)]" />
          <CubeCluster
            className="absolute -right-2 -bottom-3 h-[115%] opacity-90"
            viewBox="0 0 200 160"
            cubes={[
              { x: 150, y: 30, s: 36, tone: "navy" },
              { x: 100, y: 64, s: 30, tone: "blue" },
              { x: 168, y: 92, s: 24, tone: "maize" },
              { x: 60, y: 104, s: 20, tone: "sky" },
            ]}
          />
          <Icon className="absolute top-1/2 left-5 size-12 -translate-y-1/2 text-white/25" strokeWidth={1.5} />
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-[#0d2741]/90 to-transparent" />
    </div>
  );
}

/**
 * The club mascot (public/art/mascot.png, 268x504 transparent PNG). Its navy
 * shirt blends into navy, so it always sits on a soft maize glow and a lighter
 * platform. Never rendered above its natural size (height is capped).
 */
export function Mascot({ className = "h-56", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <div className={`relative isolate aspect-[268/504] max-h-[504px] ${className}`}>
      <div
        aria-hidden="true"
        className="absolute inset-[-30%_-55%_-6%] -z-10 bg-[radial-gradient(closest-side,rgb(240_196_19/0.42),rgb(240_196_19/0.12)_55%,transparent)]"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-[3%] left-1/2 -z-10 h-[9%] w-[130%] -translate-x-1/2 rounded-[50%] bg-[#dfe8f3]/25 blur-[2px]"
      />
      <Image
        src="/art/mascot.png"
        alt="The Roblox at UM mascot"
        width={268}
        height={504}
        sizes="(min-width: 640px) 160px, 120px"
        loading={priority ? "eager" : "lazy"}
        className="size-full object-contain drop-shadow-[0_6px_16px_rgb(0_0_0/0.35)]"
      />
    </div>
  );
}

/** Empty-state illustration: a block calendar on a little platform. */
export function EmptyStateArt({ className = "" }: { className?: string }) {
  if (art.emptyState) {
    // 4:3 like the SVG below (480x360 source), so a height-only className still sizes it.
    return (
      <div aria-hidden="true" className={`relative aspect-[4/3] ${className}`}>
        <Image src={art.emptyState} alt="" fill sizes="240px" className="object-contain" />
      </div>
    );
  }
  return (
    <svg viewBox="0 0 220 170" className={className} aria-hidden="true" focusable="false">
      {/* platform */}
      <polygon points="110,120 190,146 110,170 30,146" fill="#1c4570" />
      <polygon points="30,146 110,170 110,170 30,152" fill="#11314f" />
      {/* calendar */}
      <g className="animate-float [transform-box:fill-box]">
        <rect x="62" y="30" width="96" height="92" rx="12" fill="#dfe8f3" />
        <rect x="62" y="30" width="96" height="28" rx="12" fill="#f0c413" />
        <rect x="62" y="46" width="96" height="12" fill="#f0c413" />
        <rect x="82" y="20" width="10" height="22" rx="5" fill="#c49a08" />
        <rect x="128" y="20" width="10" height="22" rx="5" fill="#c49a08" />
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => (
            <rect key={`${r}${c}`} x={76 + c * 24} y={66 + r * 17} width="16" height="12" rx="3"
              fill={r === 1 && c === 1 ? "#f0c413" : "#3b6c9c"} />
          )),
        )}
      </g>
      {/* sparkles */}
      <g fill="#f0c413">
        <rect x="40" y="26" width="12" height="4" rx="2" transform="rotate(35 46 28)" />
        <rect x="168" y="26" width="12" height="4" rx="2" transform="rotate(-35 174 28)" />
        <rect x="174" y="52" width="12" height="4" rx="2" />
      </g>
    </svg>
  );
}

/**
 * Picture for the home page's Featured panel (e.g. a photo or render from the
 * Game Jam). Returns null when there is no image; the panel then shows its
 * icon and cubes instead.
 */
export function FeaturedArt({ className = "" }: { className?: string }) {
  if (!art.featured) return null;
  return (
    <div aria-hidden="true" className={`relative aspect-video overflow-hidden rounded-xl ${className}`}>
      <Image src={art.featured} alt="" fill sizes="(min-width: 1024px) 380px, 100vw" className="object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-surface/80 to-transparent" />
    </div>
  );
}

/**
 * Banner at the top of /join (above the fold, so it preloads). Kept short so the
 * pitch and the join buttons stay on the first phone screen. Null without an image.
 */
export function JoinBanner({ className = "" }: { className?: string }) {
  if (!art.joinHero) return null;
  return (
    <div aria-hidden="true" className={`relative aspect-[3/1] overflow-hidden rounded-2xl sm:aspect-[21/9] ${className}`}>
      <Image
        src={art.joinHero}
        alt=""
        fill
        preload
        fetchPriority="high"
        sizes="(min-width: 704px) 672px, calc(100vw - 32px)"
        className="object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-bg/70 to-transparent" />
    </div>
  );
}
