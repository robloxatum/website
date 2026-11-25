import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Vercel cron requests carry "Authorization: Bearer $CRON_SECRET". Anything
 * else is refused, and so is everything while CRON_SECRET isn't set.
 */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
