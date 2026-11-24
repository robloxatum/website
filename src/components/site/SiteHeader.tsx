import { QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/Logo";
import { button, container } from "@/components/ui/styles";
import { getProfile } from "@/lib/auth";
import { DesktopNav } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/85 backdrop-blur-md">
      {/* Tighter between md and lg so the full nav fits at 768px, signed in or out. */}
      <div className={`${container} flex h-16 items-center gap-3 lg:gap-6`}>
        <Link href="/" className="flex min-h-11 shrink-0 items-center rounded-md" aria-label="Roblox at UM home">
          <Wordmark tone="white" className="h-6 w-auto sm:h-7" />
        </Link>
        <DesktopNav />
        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<div className="size-11" />}>
            <AccountActions />
          </Suspense>
          {/* Phones get Check In in the bottom tab bar instead. */}
          <div className="hidden md:block">
            <Link href="/checkin" className={button({ size: "sm" })}>
              <QrCode aria-hidden="true" />
              Check In
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

async function AccountActions() {
  const profile = await getProfile();
  if (!profile) {
    return (
      <Link href="/login" className={button({ variant: "ghost", size: "sm" })}>
        Sign in
      </Link>
    );
  }
  const name = profile.full_name.trim() || profile.uniqname;
  return (
    <>
      {profile.is_officer && (
        <Link
          href="/officer"
          title="Officer portal"
          className={button({ variant: "secondary", size: "sm", className: "border-maize/50 max-lg:min-w-11 max-lg:px-0" })}
        >
          <ShieldCheck aria-hidden="true" className="text-maize" />
          {/* Icon-only below lg (still named for screen readers). */}
          <span className="max-lg:sr-only">Officer</span>
        </Link>
      )}
      <Link
        href="/profile"
        title="Your profile"
        aria-label={`Your profile (${name})`}
        className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-elevated font-display text-base font-bold text-fg transition-colors duration-150 hover:border-maize"
      >
        {name[0]?.toUpperCase()}
      </Link>
    </>
  );
}
