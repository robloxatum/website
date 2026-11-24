import { CalendarDays, PartyPopper, QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClubLinkButtons } from "@/components/ui/ClubLinkButtons";
import { NextEventRow } from "@/components/ui/EventCards";
import { Skeleton } from "@/components/ui/Primitives";
import { button, card, container } from "@/components/ui/styles";
import { requireMember } from "@/lib/auth";
import { getEventLists } from "@/lib/events";

export const metadata: Metadata = { title: "You're in!", robots: { index: false } };

export default function JoinDonePage() {
  return (
    <div className={`${container} max-w-xl! pt-10`}>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Welcome />
      </Suspense>
    </div>
  );
}

async function Welcome() {
  const profile = await requireMember("/join/done");
  const firstName = profile.full_name.trim().split(/\s+/)[0] || profile.uniqname;
  const { upcoming } = await getEventLists();

  return (
    <div className="text-center">
      <div className="mx-auto grid size-20 animate-pop place-items-center rounded-3xl bg-maize text-navy">
        <PartyPopper aria-hidden="true" className="size-10" />
      </div>
      <h1 className="mt-5 text-4xl text-fg">You&apos;re in, {firstName}!</h1>
      <p className="mt-2 text-fg-2">
        Welcome to Roblox at UM. At events, scan the room QR or enter the code to check in. You&apos;re already
        signed in.
      </p>

      {upcoming[0] && (
        <div className="mt-6 text-left">
          <NextEventRow event={upcoming[0]} />
        </div>
      )}

      <div className="mt-6 text-left">
        <ClubLinkButtons keys={["discord", "instagram", "maizepages", "roblox"]} />
      </div>

      <div className={`mt-6 ${card} flex flex-col gap-3 p-4 sm:flex-row`}>
        <Link href="/events" className={button({ variant: "secondary", full: true })}>
          <CalendarDays aria-hidden="true" />
          See events
        </Link>
        <Link href="/checkin" className={button({ full: true })}>
          <QrCode aria-hidden="true" />
          Check in now
        </Link>
      </div>
    </div>
  );
}
