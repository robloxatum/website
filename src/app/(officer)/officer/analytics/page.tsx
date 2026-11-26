import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { Alert } from "@/components/ui/Alert";
import { SectionLabel, Skeleton } from "@/components/ui/Primitives";
import { RANGES, parseRange, rangeBounds, type AnalyticsRange } from "@/lib/analytics";
import { getOfficer } from "@/lib/auth";
import { DEFAULT_COVERS, defaultCoverSrc } from "@/lib/covers";
import { AnalyticsView } from "./AnalyticsView";
import { DEMO_FILE, getAnalytics, getDemoAnalytics } from "./data";

export const metadata: Metadata = { title: "Analytics" };

/** The banner art: one of the default event covers (any, if this one is ever removed). */
const BANNER = DEFAULT_COVERS.find((c) => c.file.startsWith("sky-citadel")) ?? DEFAULT_COVERS[0] ?? null;

export default function AnalyticsPage(props: PageProps<"/officer/analytics">) {
  return (
    <div>
      <Banner />
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Analytics {...props} />
      </Suspense>
    </div>
  );
}

function Banner() {
  return (
    <header className="relative mb-6 overflow-hidden rounded-2xl border border-line/70 bg-bg-2 shadow-card">
      {BANNER && (
        <Image
          src={defaultCoverSrc(BANNER)}
          alt=""
          width={BANNER.width}
          height={BANNER.height}
          sizes="(min-width: 1024px) 1000px, 100vw"
          preload
          className="absolute inset-0 size-full object-cover object-[center_35%]"
        />
      )}
      {/* Darkened on the text side so the title always reads, whatever the art. */}
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-bg via-bg/80 to-bg/25" />
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-bg/70 to-transparent" />
      <div className="relative px-5 py-6 sm:px-8 sm:py-8">
        <SectionLabel className="mb-2.5">Officer portal</SectionLabel>
        <h1 className="text-3xl leading-tight text-fg sm:text-4xl">Analytics</h1>
        <p className="mt-1.5 max-w-xl text-sm text-fg-2 sm:text-base">Attendance, members and check-in habits, from our own check-ins and RSVPs.</p>
      </div>
    </header>
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
  const ranges = RANGES.map((r) => ({ ...r, href: href(r.id) }));

  return (
    <div className="space-y-6">
      {demo && (
        <Alert tone="info" title="Demo data">
          Made-up numbers from {DEMO_FILE}, only on your computer. Remove ?demo=1 to see the real numbers.
        </Alert>
      )}

      {data ? (
        <AnalyticsView data={data} bounds={bounds} ranges={ranges} allTimeHref={href("all")} />
      ) : (
        <Alert tone="error" title={demo ? "No demo data" : "Couldn’t load analytics"}>
          {demo ? "Run npm run analytics:demo first, then reload." : "Try again in a moment."}
        </Alert>
      )}
    </div>
  );
}
