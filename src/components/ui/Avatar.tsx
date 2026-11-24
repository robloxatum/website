"use client";

import Image from "next/image";
import { useState } from "react";

const SIZES = {
  sm: { box: "size-8 text-sm", px: 32 },
  md: { box: "size-11 text-base", px: 44 },
  lg: { box: "size-16 text-3xl", px: 64 },
} as const;

/**
 * A member's icon: their Roblox avatar headshot (fetched server-side, see
 * lib/roblox.ts) or, with no headshot or if the image fails to load, the
 * first letter of their name. Decorative: the name is always shown or
 * announced next to it.
 */
export function Avatar({
  name,
  src,
  size = "md",
  tone = "plain",
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  /** "maize" for the big profile icon, "plain" elsewhere (matches the old initial icons). */
  tone?: "plain" | "maize";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const s = SIZES[size];
  const shape = size === "lg" ? "rounded-2xl" : "rounded-full";
  const border = tone === "plain" ? "border border-line" : "";

  if (src && !failed) {
    return (
      <span aria-hidden="true" className={`relative block shrink-0 overflow-hidden ${shape} ${border} bg-elevated ${s.box} ${className}`}>
        <Image
          src={src}
          alt=""
          width={s.px}
          height={s.px}
          sizes={`${s.px}px`}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      </span>
    );
  }
  const colors = tone === "maize" ? "bg-maize text-navy" : `${border} bg-elevated text-fg`;
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center ${shape} font-display font-extrabold ${colors} ${s.box} ${className}`}>
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
