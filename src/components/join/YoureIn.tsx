import { CalendarDays, PartyPopper, QrCode } from "lucide-react";
import Link from "next/link";
import { ClubLinkButtons, MailingListButton } from "@/components/ui/ClubLinkButtons";
import { NextEventRow } from "@/components/ui/EventCards";
import { button, card } from "@/components/ui/styles";
import { getEventLists } from "@/lib/events";
import { callName } from "@/lib/names";
import { getCommunityLinks } from "@/lib/site-content-data";
import type { Profile } from "@/lib/types";

/**
 * "You're in, <name>!": next event, event updates and community links. Shown
 * after signing up (/join/done) and to members who open /join again.
 */
export async function YoureIn({ profile }: { profile: Profile }) {
  const [{ upcoming }, links] = await Promise.all([getEventLists(), getCommunityLinks()]);

  return (
    <div className="text-center">
      <div className="mx-auto grid size-20 animate-pop place-items-center rounded-3xl bg-maize text-navy">
        <PartyPopper aria-hidden="true" className="size-10" />
      </div>
      <h1 className="mt-5 text-4xl text-fg">You&apos;re in, {callName(profile)}!</h1>
      <p className="mt-2 text-fg-2">
        Welcome to Roblox at UM. At events, scan the room QR or enter the code to check in. You&apos;re already
        signed in.
      </p>

      {upcoming[0] && (
        <div className="mt-6 text-left">
          <NextEventRow event={upcoming[0]} />
        </div>
      )}

      <div className="mt-6">
        <MailingListButton variant="primary" full />
      </div>

      <h2 className="mt-8 text-left text-xl text-fg">Join the community</h2>
      <div className="mt-3 text-left">
        <ClubLinkButtons links={links} />
      </div>

      <div className={`mt-6 ${card} flex flex-col gap-3 p-4 sm:flex-row`}>
        <Link href="/events" className={button({ variant: "secondary", full: true })}>
          <CalendarDays aria-hidden="true" />
          See events
        </Link>
        <Link href="/checkin" className={button({ variant: "secondary", full: true })}>
          <QrCode aria-hidden="true" />
          Check in now
        </Link>
      </div>
    </div>
  );
}
