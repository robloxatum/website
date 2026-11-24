import type { Metadata } from "next";
import { CalendarButton, ClubLinkButtons, MailingListButton } from "@/components/ui/ClubLinkButtons";
import { PageHeader } from "@/components/ui/Primitives";
import { container } from "@/components/ui/styles";
import { COMMUNITY_KEYS } from "@/lib/links";

export const metadata: Metadata = { title: "Links" };

// Linked from our Instagram bio: keep it fast and simple.
export default function LinksPage() {
  return (
    <div className={`${container} max-w-xl! pt-10`}>
      <PageHeader label="Find us" title="Links" description="Everywhere Roblox at UM hangs out." />
      <ClubLinkButtons keys={[...COMMUNITY_KEYS, "email"]} withBlurb />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <MailingListButton full />
        <CalendarButton full />
      </div>
    </div>
  );
}
