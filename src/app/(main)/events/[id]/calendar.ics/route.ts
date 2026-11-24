import { buildIcs, icsFileName } from "@/lib/calendar";
import { getPublicEvent } from "@/lib/events";

/**
 * /events/<id>/calendar.ics: the event as a calendar file (Apple Calendar,
 * Outlook, ...). Same UID on every download, so importing it again updates the
 * existing entry instead of adding a duplicate.
 */
export async function GET(request: Request, ctx: RouteContext<"/events/[id]/calendar.ics">) {
  const { id } = await ctx.params;
  const event = await getPublicEvent(id); // validates the id; cached, public fields only
  if (!event) return new Response("Event not found", { status: 404 });

  const base = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const ics = buildIcs(event, `${base}/events/${event.id}`);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFileName(event.title)}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
