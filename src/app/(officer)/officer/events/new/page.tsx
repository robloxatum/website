import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { PageHeader, Skeleton } from "@/components/ui/Primitives";
import { getOfficer } from "@/lib/auth";
import { EventForm } from "../../_components/EventForm";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="max-w-3xl">
      <Link href="/officer/events" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-fg-2 hover:text-maize">
        <ArrowLeft aria-hidden="true" className="size-4" /> Events
      </Link>
      <PageHeader label="Officer portal" title="New event" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  if (!(await getOfficer("/officer/events/new"))) return <OfficersOnly />;
  return <EventForm />;
}
