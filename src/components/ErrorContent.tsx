"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BrandIcon } from "@/components/Logo";
import { button } from "@/components/ui/styles";

/**
 * Error body ("Something broke"), matching the 404. Used by each route
 * group's error.tsx, inside that group's layout. `reset` re-renders the page.
 */
export function ErrorContent({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[70dvh] place-items-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <BrandIcon className="mx-auto size-24" alt="" />
        <h1 className="text-4xl text-fg">Oof. Something broke.</h1>
        <p className="text-lg text-fg-2">
          This page hit an error. Try again, and if it keeps happening, let an officer know.
        </p>
        {error.digest && <p className="text-xs text-fg-3">Error code: {error.digest}</p>}
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className={button({ size: "lg" })}>
            Try again
          </button>
          <Link href="/" className={button({ variant: "secondary", size: "lg" })}>
            Respawn at home
          </Link>
        </div>
      </div>
    </div>
  );
}
