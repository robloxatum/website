import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isCacheFunctionReference } from "@/lib/server-reference";
import { authCookieOptions } from "@/lib/supabase/cookie-options";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase session cookie on each request so Server Components
 * see a valid session. Authorization is NOT done here: pages check the user,
 * and RLS enforces access in the database. The one thing refused here is a
 * POST naming a "use cache" function as if it were a Server Action.
 */
export async function proxy(request: NextRequest) {
  // "use cache" functions are not Server Actions: never run one for a POST that
  // names it (see lib/server-reference.ts). The app's own forms and buttons
  // only send real action IDs, so this changes nothing for them.
  if (isCacheFunctionReference(request.headers.get("next-action"))) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Validates the JWT and refreshes it if it has expired.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Skip static files, images, the service worker and /go short links (plain redirects; no session needed).
    "/((?!_next/static|_next/image|go/|go$|favicon.ico|icon.svg|sw.js|offline.html|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    // Every request that names a Server Action, on ANY path (a page path like
    // /events/x.png would otherwise skip the line above), so the check runs.
    { source: "/:path*", has: [{ type: "header", key: "next-action" }] },
  ],
};
