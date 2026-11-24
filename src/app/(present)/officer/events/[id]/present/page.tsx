import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { getOfficer } from "@/lib/auth";
import { isUuid } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { getOfficerEvent } from "@/app/(officer)/officer/data";
import { PresentClient } from "./PresentClient";

export const metadata: Metadata = { title: "Check-in" };

export default function PresentPage({ params }: PageProps<"/officer/events/[id]/present">) {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center font-display text-2xl font-bold text-maize">Loading…</div>}>
      <Present params={params} />
    </Suspense>
  );
}

async function Present({ params }: { params: PageProps<"/officer/events/[id]/present">["params"] }) {
  const { id } = await params;
  if (!(await getOfficer(`/officer/events/${id}/present`))) {
    return (
      <div className="mx-auto max-w-md p-8">
        <OfficersOnly />
      </div>
    );
  }
  if (!isUuid(id)) notFound();

  const data = await getOfficerEvent(id);
  if (!data || !data.code) notFound();

  const supabase = await createClient();
  const { count } = await supabase
    .from("attendance")
    .select("*", { count: "exact", head: true })
    .eq("event_id", id);

  // Prefer the configured public URL so the QR always points at production.
  const host = (await headers()).get("host");
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `https://${host}`).replace(/\/$/, "");

  return (
    <PresentClient
      checkinUrl={`${base}/checkin?code=${data.code}`}
      eventId={id}
      title={data.event.title}
      startsAt={data.event.starts_at}
      capacity={data.event.capacity}
      code={data.code}
      initialCount={count ?? 0}
      initialFlags={{
        checkin_open: data.event.checkin_open,
        checkin_reopened: data.event.checkin_reopened,
        ends_at: data.event.ends_at,
      }}
    />
  );
}
