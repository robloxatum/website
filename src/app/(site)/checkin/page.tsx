import type { Metadata } from "next";
import { Suspense } from "react";
import { SkeletonBlock } from "@/components/Notice";
import { requireMember } from "@/lib/auth";
import { normalizeCode } from "@/lib/checkin-state";
import { CheckinClient } from "./CheckinClient";

export const metadata: Metadata = { title: "Check in" };

export default function CheckinPage({ searchParams }: PageProps<"/checkin">) {
  return (
    <div className="mx-auto max-w-md">
      <Suspense fallback={<SkeletonBlock className="h-80" />}>
        <CheckinGate searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CheckinGate({ searchParams }: { searchParams: PageProps<"/checkin">["searchParams"] }) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? normalizeCode(params.code).slice(0, 5) : "";
  const returnTo = code ? `/checkin?code=${encodeURIComponent(code)}` : "/checkin";

  // Signed out -> Google -> (first time) /welcome -> back here with the code.
  const profile = await requireMember(returnTo);
  const firstName = profile.full_name.split(" ")[0] || profile.uniqname;

  return <CheckinClient initialCode={code} firstName={firstName} />;
}
