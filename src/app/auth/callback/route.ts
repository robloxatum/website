import { NextResponse, type NextRequest } from "next/server";
import { isUmichEmail } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/** Google -> Supabase -> here. Exchanges the code for a session cookie. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const fail = (reason: string) =>
    to(`/login?error=${reason}&next=${encodeURIComponent(next)}`);

  // Set when the before-user-created hook refuses a non-umich account.
  const errorDescription = params.get("error_description") ?? params.get("error");
  if (errorDescription) {
    return fail(/umich/i.test(errorDescription) ? "not_umich" : "oauth");
  }

  const code = params.get("code");
  if (!code) return fail("oauth");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail("oauth");

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !isUmichEmail(claims.email as string | undefined)) {
    await supabase.auth.signOut();
    return fail("not_umich");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile?.onboarded_at) {
    return to(`/welcome?next=${encodeURIComponent(next)}`);
  }
  return to(next);
}
