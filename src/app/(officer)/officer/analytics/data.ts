import "server-only";
import type { AnalyticsData, AnalyticsRange, RangeBounds } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";

/**
 * Aggregates from public.officer_analytics (officers only; the database
 * checks). Only these totals reach the page, never who checked in.
 */
export async function getAnalytics(bounds: RangeBounds): Promise<AnalyticsData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("officer_analytics", {
    p_from: bounds.from?.toISOString() ?? null,
    p_to: bounds.to.toISOString(),
  });
  if (error) {
    console.error("Failed to load analytics", error.message);
    return null;
  }
  return data as AnalyticsData;
}

/** The file `npm run analytics:demo` writes (git-ignored). */
export const DEMO_FILE = ".analytics-demo.json";

/**
 * Made-up demo numbers for trying the page locally (`?demo=1`). Only in
 * `next dev`; production builds never read the file.
 */
export async function getDemoAnalytics(range: AnalyticsRange): Promise<AnalyticsData | null> {
  if (process.env.NODE_ENV !== "development") return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const all = JSON.parse(await readFile(`${process.cwd()}/${DEMO_FILE}`, "utf8")) as Partial<Record<AnalyticsRange, AnalyticsData>>;
    return all[range] ?? null;
  } catch {
    return null;
  }
}
