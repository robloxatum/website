import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/Logo";
import { button, container } from "@/components/ui/styles";
import { Avatar } from "@/components/ui/Avatar";
import { getProfile } from "@/lib/auth";
import { getMemberNav } from "@/lib/member-nav";
import { callName } from "@/lib/names";
import { headshotFor } from "@/lib/roblox";
import { DesktopNav, HeaderCheckIn } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/85 backdrop-blur-md">
      {/* Tighter between md and lg so the full nav fits at 768px, signed in or out. */}
      <div className={`${container} flex h-16 items-center gap-3 lg:gap-6`}>
        <Link href="/" className="flex min-h-11 shrink-0 items-center rounded-md" aria-label="Roblox at UM home">
          <Wordmark tone="white" className="h-6 w-auto sm:h-7" />
        </Link>
        <Suspense fallback={<DesktopNav member={null} />}>
          <MemberDesktopNav />
        </Suspense>
        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<div className="size-11" />}>
            <AccountActions />
          </Suspense>
          {/* Phones get Check In / Play in the bottom tab bar instead. */}
          <div className="hidden md:block">
            <Suspense fallback={<HeaderCheckIn events={[]} />}>
              <MemberCheckIn />
            </Suspense>
          </div>
        </div>
      </div>
    </header>
  );
}

/** Members don't get "Join" in the nav. */
async function MemberDesktopNav() {
  const { member } = await getMemberNav();
  return <DesktopNav member={member} />;
}

/** Check In, or Play while checked in to a live event. */
async function MemberCheckIn() {
  const { checkedIn } = await getMemberNav();
  return <HeaderCheckIn events={checkedIn} />;
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
  const name = callName(profile);
  // Cached about an hour; null (initial-letter icon) if Roblox is unavailable.
  const avatar = await headshotFor(profile);
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
        className="group shrink-0 rounded-full"
      >
        <Avatar
          name={name}
          src={avatar}
          className="transition-colors duration-150 group-hover:border-maize"
        />
      </Link>
    </>
  );
}
