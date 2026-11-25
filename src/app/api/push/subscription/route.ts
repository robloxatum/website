import { getUser } from "@/lib/auth";
import { saveDevice } from "@/lib/push/devices";

/**
 * The service worker's "pushsubscriptionchange": the browser replaced this
 * device's subscription; save the new one (settings carry over). The page
 * itself uses the Server Actions in profile/notification-actions.ts.
 *
 * Same-site JSON only: a JSON body can't come from another site's form, and
 * the Origin must be ours.
 */
export async function POST(request: Request) {
  const noStore = { "Cache-Control": "no-store" };
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin || !request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ ok: false }, { status: 403, headers: noStore });
  }
  if (!(await getUser())) return Response.json({ ok: false }, { status: 401, headers: noStore });
  let body: { subscription?: unknown; replaces?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400, headers: noStore });
  }
  const { error } = await saveDevice(body.subscription, {}, typeof body.replaces === "string" ? body.replaces : null);
  return Response.json({ ok: !error }, { status: error ? 400 : 200, headers: noStore });
}
