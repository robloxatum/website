"use client";

import Image from "next/image";
import { useState } from "react";
import { initials } from "@/lib/site-content";

/**
 * A founder's full-body Roblox avatar (looked up server-side, lib/roblox.ts),
 * or their initials when there's none or it fails to load. Decorative: the
 * name is right below it.
 */
export function FounderAvatar({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      aria-hidden="true"
      className="relative aspect-square bg-[radial-gradient(circle_at_50%_30%,rgb(240_196_19/0.16),transparent_65%)] bg-elevated/50"
    >
      {src && !failed ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 1024px) 270px, (min-width: 768px) 30vw, 45vw"
          // Straight from Roblox's CDN, not through our image optimizer (audit 3, M-1).
          unoptimized
          onError={() => setFailed(true)}
          className="object-contain p-2"
          data-testid="founder-avatar"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-display text-4xl font-extrabold text-maize sm:text-5xl">
          {initials(name)}
        </span>
      )}
    </div>
  );
}
