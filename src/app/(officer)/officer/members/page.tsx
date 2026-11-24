import type { Metadata } from "next";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { PageHeader, Skeleton } from "@/components/ui/Primitives";
import { getOfficer } from "@/lib/auth";
import { headshotsFor } from "@/lib/roblox";
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
  // Roblox headshots (cached ~1 hour; null → initial-letter icon).
  const avatars = await headshotsFor(members);
  return <MembersTable members={members.map((m, i) => ({ ...m, avatar: avatars[i] }))} currentUserId={officer.id} canManageOfficers={officer.is_owner} />;
}
