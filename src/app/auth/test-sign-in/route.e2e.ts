// TEST-ONLY sign-in for the end-to-end tests. The ".e2e.ts" extension means
// Next only compiles this file into E2E builds (see pageExtensions in
// next.config.ts); production builds don't contain it at all, and
// e2e/prod-build.check.mjs proves that. It also refuses unless e2eEnabled()
// (local test database, E2E_TEST_AUTH=1, not on Vercel).
import { NextResponse, type NextRequest } from "next/server";
import { e2eEnabled } from "@/lib/e2e";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/** GET /auth/test-sign-in?email=…&next=… — signs in a seeded test user, then goes where Google sign-in would. */
export async function GET(request: NextRequest) {
  const password = process.env["E2E_TEST_PASSWORD"];
  if (!e2eEnabled() || !password) return new NextResponse("Not found", { status: 404 });

  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const email = params.get("email") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return new NextResponse(`Test sign-in failed: ${error?.message}`, { status: 401 });

  // Same as /auth/callback after Google: first-timers go to /welcome.
  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", data.user.id).maybeSingle();
  const to = profile?.onboarded_at ? next : `/welcome?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(to, request.url));
}
