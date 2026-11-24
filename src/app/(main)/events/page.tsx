import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/Blocks";
import { CalendarButton, MailingListButton } from "@/components/ui/ClubLinkButtons";
import { EventGrid } from "@/components/ui/EventCards";
import { PageHeader } from "@/components/ui/Primitives";
import { container } from "@/components/ui/styles";
import { Tabs } from "@/components/ui/Tabs";
import { getEventLists } from "@/lib/events";

export const metadata: Metadata = {
  title: "Events",
  description: "Game nights, hangouts, game jams and workshops from Roblox at UM.",
};

export default async function EventsPage() {
  const { upcoming, past } = await getEventLists();
  const all = [...upcoming, ...past];

  const noUpcoming = (
    <EmptyState title="Ready for the next game night?" action={<MailingListButton />}>
      Nothing is scheduled right now. Get event updates and we&apos;ll tell you when the next one is on.
    </EmptyState>
  );

  return (
    <div className={`${container} pt-10`}>
      <PageHeader
        label="What's happening"
        title="Events"
        description="Game nights, hangouts, game jams and workshops. Everyone at U-M is welcome."
        actions={<CalendarButton variant="primary" />}
      />
      <Tabs
        label="Events"
        tabs={[
          { id: "upcoming", label: "Upcoming", count: upcoming.length, content: upcoming.length ? <EventGrid events={upcoming} headingLevel="h2" /> : noUpcoming },
          {
            id: "past",
            label: "Past",
            count: past.length,
            content: past.length ? (
              <EventGrid events={past.slice(0, 60)} headingLevel="h2" />
            ) : (
              <p className="flex items-center gap-2 text-fg-2">
                <CalendarDays aria-hidden="true" className="size-5 text-fg-3" /> No past events yet.
              </p>
            ),
          },
          { id: "all", label: "All", count: all.length, content: all.length ? <EventGrid events={all.slice(0, 80)} headingLevel="h2" /> : noUpcoming },
        ]}
      />
    </div>
  );
}
