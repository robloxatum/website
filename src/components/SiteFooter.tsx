import Link from "next/link";
import { Wordmark } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-4 border-blue bg-blue text-white/80">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Wordmark tone="white" className="h-6 w-auto" />
          <p>A student org at the University of Michigan</p>
        </div>
        <p className="text-xs text-white/60">
          Not affiliated with or endorsed by Roblox Corporation.{" "}
          <Link href="/privacy" className="underline hover:text-maize">
            Privacy
          </Link>
          {" · "}
          <Link href="/links" className="underline hover:text-maize">
            Contact
          </Link>
        </p>
      </div>
    </footer>
  );
}
