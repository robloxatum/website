import Image from "next/image";
import icon from "@/assets/brand/icon.png";
import wordmarkNavy from "@/assets/brand/wordmark-navy.png";
import wordmarkWhite from "@/assets/brand/wordmark-white.png";

/**
 * Roblox at UM wordmark. Use tone="white" on navy/dark backgrounds and
 * tone="navy" on light/cream ones. Size it with a height class (width follows).
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

/** The square brand icon. */
export function BrandIcon({ className = "size-10" }: { className?: string }) {
  return <Image src={icon} alt="Roblox at UM" className={className} sizes="160px" />;
}
