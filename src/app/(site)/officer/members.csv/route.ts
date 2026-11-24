import { getProfile } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/time";
import { getMembers } from "../members/data";

export async function GET() {
  const profile = await getProfile();
  if (!profile?.is_officer) return new Response("Officers only", { status: 403 });

  const members = await getMembers();
  const csv = toCsv([
    ["Name", "Uniqname", "Email", "Roblox username", "Officer", "Events attended", "Last check-in", "Joined"],
    ...members.map((m) => [
      m.full_name,
      m.uniqname,
      `${m.uniqname}@umich.edu`,
      m.roblox_username,
      m.is_officer ? "yes" : "no",
      m.total_attendance,
      m.last_checked_in_at ? formatDate(m.last_checked_in_at) : "",
      formatDate(m.created_at),
    ]),
  ]);
  return csvResponse(csv, `members-${new Date().toISOString().slice(0, 10)}.csv`);
}
