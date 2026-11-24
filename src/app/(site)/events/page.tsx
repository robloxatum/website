import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import { PageTitle } from "@/components/Notice";
import { CalendarButton } from "@/components/ui/ClubLinkButtons";
import { getEventLists } from "@/lib/events";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const { upcoming, past } = await getEventLists();

  return (
    <div>
      <PageTitle kicker="What's happening">Events</PageTitle>
      {/* Phase 2 restyles this page; the calendar button is already final. */}
      <div className="mb-8">
        <CalendarButton variant="primary" />
      </div>

      <section className="space-y-4">
        <h2 className="text-xl">Upcoming</h2>
        {upcoming.length ? (
          upcoming.map((e) => <EventCard key={e.id} event={e} />)
        ) : (
          <p className="block-card p-4">Nothing scheduled yet. Check back soon!</p>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-10 space-y-4">
          <h2 className="text-xl">Past events</h2>
          {past.slice(0, 30).map((e) => (
            <EventCard key={e.id} event={e} muted />
          ))}
        </section>
      )}
    </div>
  );
}
