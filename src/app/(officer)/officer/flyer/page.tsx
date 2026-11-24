import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { PageHeader, Skeleton } from "@/components/ui/Primitives";
import { getOfficer } from "@/lib/auth";
import { FlyerTool } from "./FlyerTool";

export const metadata: Metadata = { title: "Flyer QR" };

export default function FlyerPage() {
  return (
    <div>
      <PageHeader
        label="Officer portal"
        title="Flyer QR"
        description="Make a QR code for a flyer or poster. It opens our Join page, and the label tells us which flyer people scanned."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Flyer />
      </Suspense>
    </div>
  );
}

async function Flyer() {
  if (!(await getOfficer("/officer/flyer"))) return <OfficersOnly />;
  // The site's public URL (follows a custom domain when NEXT_PUBLIC_SITE_URL changes).
  const host = (await headers()).get("host");
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `https://${host}`).replace(/\/$/, "");
  return <FlyerTool baseUrl={base} />;
}
