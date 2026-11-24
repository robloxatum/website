import { getProfile } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { isUuid } from "@/lib/events";
import { formatDateTime } from "@/lib/time";
import { getAttendees, getOfficerEvent, getRsvps } from "../../../data";

export async function GET(_request: Request, ctx: RouteContext<"/officer/events/[id]/attendance.csv">) {
  const { id } = await ctx.params;
  const profile = await getProfile();
  if (!profile?.is_officer) return new Response("Officers only", { status: 403 });
  if (!isUuid(id)) return new Response("Not found", { status: 404 });

  const data = await getOfficerEvent(id);
  if (!data) return new Response("Not found", { status: 404 });
  const [attendees, rsvps] = await Promise.all([getAttendees(id), getRsvps(id)]);
  const rsvped = new Set(rsvps.map((r) => r.user_id));

  const csv = toCsv([
    ["Name", "Uniqname", "Email", "Roblox username", "Checked in (Ann Arbor time)", "RSVP"],
    ...attendees.map((a) => [
      a.profiles?.full_name,
      a.profiles?.uniqname,
      a.profiles ? `${a.profiles.uniqname}@umich.edu` : "",
      a.profiles?.roblox_username,
      formatDateTime(a.checked_in_at),
      rsvped.has(a.user_id) ? "Yes" : "No",
    ]),
  ]);
  const date = data.event.starts_at.slice(0, 10);
  return csvResponse(csv, `attendance-${date}-${data.event.title}.csv`);
}
