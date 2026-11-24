import { connection } from "next/server";
import { shortlinks } from "@/content/shortlinks";
import { shortlinkRedirect } from "@/lib/shortlinks";

/**
 * Flyer short links: /go/<slug> → a temporary redirect chosen by the current
 * time (see src/content/shortlinks.ts). /go, /go/a/b and unknown slugs go home.
 * Never renders a page, so a scan can't land on an error screen.
 */
export async function GET(request: Request, ctx: RouteContext<"/go/[[...slug]]">) {
  await connection(); // decide per request (the answer depends on the clock)
  let segments: string[] | undefined;
  try {
    segments = (await ctx.params).slug;
  } catch {
    segments = undefined;
  }
  return shortlinkRedirect(shortlinks, segments, new Date(), request.url);
}
