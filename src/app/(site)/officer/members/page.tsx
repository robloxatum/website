import type { Metadata } from "next";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { PageTitle, SkeletonBlock } from "@/components/Notice";
import { getOfficer } from "@/lib/auth";
import { OfficerTabs } from "../_components/OfficerTabs";
import { getMembers } from "./data";
import { MembersTable } from "./MembersTable";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <div>
      <PageTitle kicker="Officers">Members</PageTitle>
      <Suspense fallback={<SkeletonBlock className="h-96" />}>
        <Members />
      </Suspense>
    </div>
  );
}

async function Members() {
  const officer = await getOfficer("/officer/members");
  if (!officer) return <OfficersOnly />;
  const members = await getMembers();

  return (
    <div>
      <OfficerTabs active="members" />
      <MembersTable members={members} currentUserId={officer.id} />
    </div>
  );
}
