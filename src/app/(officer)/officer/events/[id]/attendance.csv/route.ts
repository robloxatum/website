import { getProfile } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { isUuid } from "@/lib/events";
import { formatDateTime } from "@/lib/time";
import { type AttendeeRow, getAttendees, getOfficerEvent, getRsvps } from "../../../data";

export async function GET(_request: Request, ctx: RouteContext<"/officer/events/[id]/attendance.csv">) {
  const { id } = await ctx.params;
  const profile = await getProfile();
  if (!profile?.is_officer) return new Response("Officers only", { status: 403 });
  if (!isUuid(id)) return new Response("Not found", { status: 404 });

  const data = await getOfficerEvent(id);
  if (!data) return new Response("Not found", { status: 404 });
  const [attendees, rsvps] = await Promise.all([getAttendees(id), getRsvps(id)]);
  const rsvped = new Set(rsvps.map((r) => r.user_id));
  const checkedIn = new Set(attendees.map((a) => a.user_id));
  const person = (p: AttendeeRow["profiles"]) => [
    p?.full_name,
    p?.nickname,
    p?.uniqname,
    p ? `${p.uniqname}@umich.edu` : "",
    p?.roblox_username,
  ];

  // Everyone who checked in, then people who RSVP'd but didn't check in.
  const csv = toCsv([
    ["Name", "Nickname", "Uniqname", "Email", "Roblox username", "Checked in", "Checked in at (Ann Arbor time)", "RSVP"],
    ...attendees.map((a) => [
      ...person(a.profiles),
      "Yes",
      formatDateTime(a.checked_in_at),
      rsvped.has(a.user_id) ? "Yes" : "No",
    ]),
    ...rsvps.filter((r) => !checkedIn.has(r.user_id)).map((r) => [...person(r.profiles), "No", "", "Yes"]),
  ]);
  const date = data.event.starts_at.slice(0, 10);
  return csvResponse(csv, `attendance-${date}-${data.event.title}.csv`);
}
