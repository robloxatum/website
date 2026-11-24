import type { Metadata } from "next";
import { Suspense } from "react";
import { YoureIn } from "@/components/join/YoureIn";
import { Skeleton } from "@/components/ui/Primitives";
import { container } from "@/components/ui/styles";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "You're in!", robots: { index: false } };

export default function JoinDonePage() {
  return (
    <div className={`${container} max-w-xl! pt-10`}>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Welcome />
      </Suspense>
    </div>
  );
}

async function Welcome() {
  const profile = await requireMember("/join/done");
  return <YoureIn profile={profile} />;
}
