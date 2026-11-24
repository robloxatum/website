import Image from "next/image";
import { art } from "@/content/art";
import { categoryInfo } from "@/lib/categories";
import type { EventCategory } from "@/lib/types";
import { CubeCluster } from "./Cubes";
import { VoxelSkyline } from "./Skyline";

/**
 * Reusable art frames. Each takes an optional image (from src/content/art.ts)
 * and blends it into the UI with gradients and masks; without one it draws a
 * vector fallback, so nothing ever shows as broken.
 */

const fadeLeft = "[mask-image:linear-gradient(to_right,transparent,black_35%)]";

/**
 * Desktop: navy from the left edge through the text column, then clear over the
 * scene. The stops follow the text column (max-w-xl inside the max-w-6xl
 * container), not the screen, so on wide screens the tagline never ends up over
 * the bright clouds while the friends and tower stay untouched.
 */
const textEnd = "(max(1.5rem, 50% - 34.5rem) + 36rem)";
const heroDesktopShade = {
  backgroundImage: `linear-gradient(to right, var(--color-bg) 0, rgb(6 21 37 / 0.9) calc(${textEnd} - 12rem), rgb(6 21 37 / 0.7) calc(${textEnd}), transparent calc(${textEnd} + 14rem))`,
};

/**
 * Hero background for the home page. With an image (src/content/art.ts) it is a
 * full-bleed background behind the whole hero. Its top is already header navy,
 * so only the bottom fades into the page. Phones crop toward the friends and the
 * tower and darken behind the stacked text; from lg up a left-to-right shade
 * keeps the logo, tagline and buttons readable over the empty sky. Without an
 * image it falls back to the SVG skyline.
 */
export function HeroScene({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {art.hero ? (
        <>
          {/* Phones/tablets: a box at the bottom of the hero, shorter than the hero so the
              crop takes in both the friends and the tower; its top is the image's navy sky
              and fades into the page behind the text. From lg up it fills the whole hero. */}
          <div className="absolute inset-x-0 bottom-0 h-[420px] sm:h-[520px] lg:inset-y-0 lg:h-auto">
            <Image
              src={art.hero}
              alt=""
              fill
              preload
              fetchPriority="high"
              placeholder="blur"
              // Phones: cover scales the image to the box height (~980-1220px wide).
              // Desktop: full-bleed at the screen width.
              sizes="(max-width: 1023px) 1220px, 100vw"
              className="object-cover object-[65%_center] lg:object-[center_30%]"
            />
          </div>
          {/* Phones/tablets: the text stacks over the scene; a darker wash at the top keeps
              it readable, easing off lower down where the friends sit. */}
          <div className="absolute inset-0 bg-linear-to-b from-bg from-15% via-bg/75 via-50% to-bg/10 lg:hidden" />
          <div className="absolute inset-0 hidden lg:block" style={heroDesktopShade} />
        </>
      ) : (
        <div className={`absolute inset-y-0 right-0 w-full lg:w-[62%] ${fadeLeft}`}>
          <VoxelSkyline className="absolute inset-0 size-full opacity-30 lg:opacity-100" />
        </div>
      )}
      {/* Blend into the page at the bottom, so there's no edge above Upcoming Events. */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-bg via-bg/60 to-transparent sm:h-36" />
    </div>
  );
}

/** Cover art for an event card: category image, or a category gradient with cubes. */
export function EventCover({
  category,
  className = "",
  sizes = "(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw",
}: {
  category: EventCategory | string;
  className?: string;
  sizes?: string;
}) {
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
