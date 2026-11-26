// Options for Supabase's auth cookies, shared by the browser, server and proxy
// clients. No runtime imports: the unit tests run this file directly with Node.
//
// Secure in production builds only: localhost (next dev, the E2E build) is
// plain http, where a Secure cookie would never be sent back and sign-in
// would silently fail. next.config.ts decides at build time and inlines it.

/** Whether a build for this Vercel environment should mark auth cookies Secure. */
export function secureAuthCookies(vercelEnv: string | undefined): boolean {
  return vercelEnv === "production";
}

/** For createServerClient / createBrowserClient. SameSite stays Lax (the library default). */
export function authCookieOptions(secure = process.env.AUTH_COOKIE_SECURE === "1") {
  return { secure, sameSite: "lax" as const, path: "/" };
}
