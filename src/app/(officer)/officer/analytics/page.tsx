import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Skeleton } from "@/components/ui/Primitives";
import { RANGES, parseRange, rangeBounds, type AnalyticsRange } from "@/lib/analytics";
import { getOfficer } from "@/lib/auth";
import { AnalyticsView } from "./AnalyticsView";
import { DEMO_FILE, getAnalytics, getDemoAnalytics } from "./data";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage(props: PageProps<"/officer/analytics">) {
  return (
    <div>
      <PageHeader label="Officer portal" title="Analytics" description="Attendance, members and check-in habits, from our own check-ins and RSVPs." />
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Analytics {...props} />
      </Suspense>
    </div>
  );
}

async function Analytics({ searchParams }: PageProps<"/officer/analytics">) {
  if (!(await getOfficer("/officer/analytics"))) return <OfficersOnly />;
  const params = await searchParams;
  const range = parseRange(params.range);
  // Local demo numbers (`npm run analytics:demo`, then ?demo=1). `next dev` only.
  const demo = process.env.NODE_ENV === "development" && params.demo === "1";
  const bounds = rangeBounds(range, new Date());
  const data = demo ? await getDemoAnalytics(range) : await getAnalytics(bounds);
  const href = (r: AnalyticsRange) => {
    const q = new URLSearchParams();
    if (r !== "semester") q.set("range", r);
    if (demo) q.set("demo", "1");
    const s = q.toString();
    return s ? `/officer/analytics?${s}` : "/officer/analytics";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Date range" className="inline-flex w-full rounded-xl border border-line/70 bg-bg-2 p-1 sm:w-auto">
          {RANGES.map((r) => (
            <Link
              key={r.id}
              href={href(r.id)}
              aria-current={r.id === range ? "page" : undefined}
              className={`flex min-h-10 flex-1 items-center justify-center rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap transition-colors sm:flex-none ${
                r.id === range ? "bg-maize text-navy" : "text-fg-2 hover:bg-white/[0.05] hover:text-fg"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-fg-3">{bounds.description}</p>
      </div>

      {demo && (
        <Alert tone="info" title="Demo data">
          Made-up numbers from {DEMO_FILE}, only on your computer. Remove ?demo=1 to see the real numbers.
        </Alert>
      )}

      {data ? (
        <AnalyticsView data={data} bounds={bounds} allTimeHref={href("all")} />
      ) : (
        <Alert tone="error" title={demo ? "No demo data" : "Couldn’t load analytics"}>
          {demo ? "Run npm run analytics:demo first, then reload." : "Try again in a moment."}
        </Alert>
      )}
    </div>
  );
}
