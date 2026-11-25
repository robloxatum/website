import { isCronRequest } from "@/lib/cron-auth";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Daily keep-alive (Vercel cron, see vercel.json): one tiny read so the free
 * Supabase project never pauses for inactivity. Read-only, as the anon role.
 *
 * Vercel sends "Authorization: Bearer $CRON_SECRET" on cron requests; anything
 * else gets 401. Without CRON_SECRET set it refuses every request.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return Response.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const { error } = await createPublicClient().from("events").select("id").limit(1);
  if (error) {
    console.error("Keep-alive query failed", error.message);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ ok: true, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
