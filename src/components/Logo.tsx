import Image from "next/image";
import icon from "@/assets/brand/icon.png";
import taglineWhite from "@/assets/brand/tagline-white.png";
import wordmarkNavy from "@/assets/brand/wordmark-navy.png";
import wordmarkWhite from "@/assets/brand/wordmark-white.png";

/**
 * Roblox at UM wordmark. Use tone="white" on dark backgrounds and tone="navy"
 * on light ones. Size it with a height class (width follows).
 */
export function Wordmark({
  tone,
  className = "h-8 w-auto",
}: {
  tone: "white" | "navy";
  className?: string;
}) {
  return (
    <Image
      src={tone === "white" ? wordmarkWhite : wordmarkNavy}
      alt="Roblox at UM"
      className={className}
      // Always eager: it's in the header, and on short pages the footer copy is
      // above the fold too. Same file and sizes, so the browser fetches it once.
      loading="eager"
      sizes="(min-width: 640px) 400px, 300px"
    />
  );
}

/** Wordmark with "Build · Create · Connect" underneath (for dark backgrounds). Hero use: preload. */
export function TaglineWordmark({ className = "w-full", preload = false }: { className?: string; preload?: boolean }) {
  return (
    <Image
      src={taglineWhite}
      alt="Roblox at UM: Build · Create · Connect"
      className={className}
      preload={preload}
      loading={preload ? undefined : "eager"}
      sizes="(min-width: 1024px) 560px, 90vw"
    />
  );
}

/** The square brand icon. */
export function BrandIcon({ className = "size-10", alt = "Roblox at UM" }: { className?: string; alt?: string }) {
  return <Image src={icon} alt={alt} className={className} sizes="160px" />;
}
