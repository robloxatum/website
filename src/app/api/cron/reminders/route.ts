import { isCronRequest } from "@/lib/cron-auth";
import { sendDueReminders } from "@/lib/push/send";

/**
 * Daily event reminders (Vercel cron, see vercel.json): a push notification
 * for each event starting in the next 24 hours, to members who turned
 * reminders on. Each event is reminded once, so a retry sends nothing twice.
 */
export async function GET(request: Request) {
  const noStore = { "Cache-Control": "no-store" };
  if (!isCronRequest(request)) return Response.json({ ok: false }, { status: 401, headers: noStore });
  try {
    const result = await sendDueReminders();
    return Response.json({ ok: true, ...result }, { headers: noStore });
  } catch (e) {
    console.error("Event reminders failed", e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 503, headers: noStore });
  }
}
