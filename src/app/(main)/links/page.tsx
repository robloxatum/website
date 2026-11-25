import type { Metadata } from "next";
import { CalendarButton, ClubLinkButtons, MailingListButton } from "@/components/ui/ClubLinkButtons";
import { PageHeader } from "@/components/ui/Primitives";
import { container } from "@/components/ui/styles";
import { getCommunityLinks } from "@/lib/site-content-data";

export const metadata: Metadata = { title: "Links" };

// Linked from our Instagram bio: keep it fast and simple.
export default async function LinksPage() {
  const links = await getCommunityLinks();
  return (
    <div className={`${container} max-w-xl! pt-10`}>
      <PageHeader label="Find us" title="Links" description="Everywhere Roblox at UM hangs out." />
      <ClubLinkButtons links={links} withBlurb withEmail />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <MailingListButton full />
        <CalendarButton full />
      </div>
    </div>
  );
}
