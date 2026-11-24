import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { PageTitle, SkeletonBlock } from "@/components/Notice";
import { getOfficer } from "@/lib/auth";
import { EventForm } from "../../_components/EventForm";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/officer" className="font-display text-sm uppercase hover:underline">
        ← Dashboard
      </Link>
      <PageTitle kicker="Officers">New event</PageTitle>
      <Suspense fallback={<SkeletonBlock className="h-96" />}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  if (!(await getOfficer("/officer/events/new"))) return <OfficersOnly />;
  return <EventForm />;
}
