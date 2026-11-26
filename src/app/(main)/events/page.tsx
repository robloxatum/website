import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { EmptyState } from "@/components/ui/Blocks";
import { CalendarButton, MailingListButton } from "@/components/ui/ClubLinkButtons";
import { EventGrid } from "@/components/ui/EventCards";
import { PageHeader } from "@/components/ui/Primitives";
import { container } from "@/components/ui/styles";
import { Tabs } from "@/components/ui/Tabs";
import { getEventLists } from "@/lib/events";

export const metadata: Metadata = pageMetadata({
  title: "Events",
  description: "Game nights, hangouts, game jams and workshops from Roblox at UM. Free for all U-M students.",
  path: "/events",
});

export default async function EventsPage() {
  const { upcoming, past } = await getEventLists();
  const all = [...upcoming, ...past];

  const noUpcoming = (
    <EmptyState headingLevel="h2" title="Ready for the next game night?" action={<MailingListButton />}>
      Nothing is scheduled right now. Get event updates and we&apos;ll tell you when the next one is on.
    </EmptyState>
  );

  return (
    <div className={`${container} pt-10`}>
      <PageHeader
        label="What's happening"
        title="Events"
        description="Game nights, hangouts, game jams and workshops. Everyone at U-M is welcome."
        actions={<CalendarButton />}
      />
      {/* Past and All only once there are past events; until then, just the upcoming list. */}
      {past.length === 0 ? (
        upcoming.length ? <EventGrid events={upcoming} headingLevel="h2" /> : noUpcoming
      ) : (
        <Tabs
          label="Events"
          tabs={[
            { id: "upcoming", label: "Upcoming", count: upcoming.length, content: upcoming.length ? <EventGrid events={upcoming} headingLevel="h2" /> : noUpcoming },
            { id: "past", label: "Past", count: past.length, content: <EventGrid events={past.slice(0, 60)} headingLevel="h2" /> },
            { id: "all", label: "All", count: all.length, content: <EventGrid events={all.slice(0, 80)} headingLevel="h2" /> },
          ]}
        />
      )}
    </div>
  );
}
