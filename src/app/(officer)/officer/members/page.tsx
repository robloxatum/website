import type { Metadata } from "next";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { PageHeader, Skeleton } from "@/components/ui/Primitives";
import { getOfficer } from "@/lib/auth";
import { getMembers } from "./data";
import { MembersTable } from "./MembersTable";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <div>
      <PageHeader label="Officer portal" title="Members" description="Everyone who has signed up, with their attendance." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Members />
      </Suspense>
    </div>
  );
}

async function Members() {
  const officer = await getOfficer("/officer/members");
  if (!officer) return <OfficersOnly />;
  const members = await getMembers();
  return <MembersTable members={members} currentUserId={officer.id} />;
}
