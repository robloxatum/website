import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Primitives";
import { container } from "@/components/ui/styles";
import { requireMember } from "@/lib/auth";
import { callName } from "@/lib/names";
import { normalizeCode } from "@/lib/checkin-state";
import { CheckinClient } from "./CheckinClient";

export const metadata: Metadata = { title: "Check in" };

export default function CheckinPage({ searchParams }: PageProps<"/checkin">) {
  return (
    <div className={`${container} pt-8 sm:pt-12`}>
      <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-md" />}>
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
  const firstName = callName(profile);

  return <CheckinClient initialCode={code} firstName={firstName} />;
}
