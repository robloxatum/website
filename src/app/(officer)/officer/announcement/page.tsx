import type { Metadata } from "next";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { PageHeader, Skeleton } from "@/components/ui/Primitives";
import { getOfficer } from "@/lib/auth";
import { getAnnouncementForOfficer } from "../data";
import { AnnouncementForm } from "./AnnouncementForm";

export const metadata: Metadata = { title: "Announcement" };

export default function AnnouncementPage() {
  return (
    <div>
      <PageHeader
        label="Officer portal"
        title="Announcement"
        description="A short message in a bar under the header on every public page. Publishing replaces the current one, and people who dismissed the old one will see the new one."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Announcement />
      </Suspense>
    </div>
  );
}

async function Announcement() {
  if (!(await getOfficer("/officer/announcement"))) return <OfficersOnly />;
  const current = await getAnnouncementForOfficer();
  return <AnnouncementForm current={current} />;
}
