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

/** Hero scene for the home page (right side on desktop, behind content on phones). */
export function HeroScene({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {art.hero ? (
        <Image
          src={art.hero}
          alt=""
          fill
          preload
          sizes="(min-width: 1024px) 60vw, 100vw"
          className={`object-cover object-right ${fadeLeft}`}
        />
      ) : (
        <div className={`absolute inset-y-0 right-0 w-full lg:w-[62%] ${fadeLeft}`}>
          <VoxelSkyline className="absolute inset-0 size-full opacity-30 lg:opacity-100" />
          <CubeCluster
            className="absolute top-[12%] right-[6%] hidden w-[38%] max-w-[300px] lg:block"
            viewBox="0 0 300 260"
            cubes={[
              { x: 210, y: 40, s: 46, tone: "maize", float: "a" },
              { x: 120, y: 120, s: 34, tone: "blue", float: "b" },
              { x: 260, y: 150, s: 26, tone: "sky", float: "c" },
              { x: 70, y: 20, s: 20, tone: "maize", float: "b" },
            ]}
          />
        </div>
      )}
      {/* Blend into the page at the bottom */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-bg to-transparent" />
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

/** An original block character (no logos, no real avatar), used in the join banner. */
export function BannerCharacter({ className = "" }: { className?: string }) {
  if (art.bannerCharacter) {
    return (
      <div aria-hidden="true" className={`relative ${className}`}>
        <Image src={art.bannerCharacter} alt="" fill sizes="240px" className="object-contain object-bottom" />
      </div>
    );
  }
  return (
    <svg viewBox="0 0 160 180" className={className} aria-hidden="true" focusable="false">
      {/* hair */}
      <rect x="44" y="10" width="72" height="18" fill="#1b1f2a" />
      <rect x="38" y="20" width="14" height="22" fill="#1b1f2a" />
      <rect x="112" y="20" width="10" height="16" fill="#1b1f2a" />
      {/* head */}
      <rect x="48" y="24" width="64" height="58" rx="6" fill="#f2c79b" />
      <rect x="48" y="24" width="64" height="12" fill="#1b1f2a" />
      <rect x="64" y="48" width="8" height="10" rx="2" fill="#1b1f2a" />
      <rect x="90" y="48" width="8" height="10" rx="2" fill="#1b1f2a" />
      <rect x="72" y="66" width="18" height="4" rx="2" fill="#9c5b3a" />
      {/* torso: plain maize hoodie with a cube print */}
      <rect x="36" y="86" width="88" height="70" rx="6" fill="#163e63" />
      <rect x="36" y="86" width="88" height="14" fill="#1d4a73" />
      <g transform="translate(70 108)">
        <polygon points="10,0 20,5 10,10 0,5" fill="#f7d64a" />
        <polygon points="0,5 10,10 10,22 0,17" fill="#f0c413" />
        <polygon points="10,10 20,5 20,17 10,22" fill="#c49a08" />
      </g>
      {/* arms */}
      <rect x="14" y="90" width="22" height="58" rx="5" fill="#163e63" />
      <rect x="124" y="90" width="22" height="58" rx="5" fill="#163e63" />
      <rect x="14" y="146" width="22" height="14" rx="4" fill="#f2c79b" />
      <rect x="124" y="146" width="22" height="14" rx="4" fill="#f2c79b" />
      {/* legs */}
      <rect x="44" y="156" width="34" height="24" fill="#0c2741" />
      <rect x="82" y="156" width="34" height="24" fill="#0c2741" />
    </svg>
  );
}

/** Empty-state illustration: a block calendar on a little platform. */
export function EmptyStateArt({ className = "" }: { className?: string }) {
  if (art.emptyState) {
    return (
      <div aria-hidden="true" className={`relative ${className}`}>
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
